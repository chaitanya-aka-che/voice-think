"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

type VoicePanelProps = {
  sessionUuid: string;
  userId: string;
  promptId: string | null;
};

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => extractTextFromContent(item))
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;

    if (typeof record.text === "string") {
      return record.text;
    }

    if (typeof record.transcript === "string") {
      return record.transcript;
    }

    if (Array.isArray(record.content)) {
      return record.content
        .map((item) => extractTextFromContent(item))
        .filter(Boolean)
        .join(" ")
        .trim();
    }
  }

  return "";
}

export function VoicePanel({ sessionUuid, userId, promptId }: VoicePanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const processedItemIdsRef = useRef<Set<string>>(new Set());
  const assistantBufferRef = useRef<Map<string, string>>(new Map());

  const disconnect = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    setStatus("idle");
    setError(null);
    processedItemIdsRef.current.clear();
    assistantBufferRef.current.clear();
  }, []);

  const logConversationEntries = useCallback(
    async (entries: Array<{ role: "user" | "assistant"; content: string }>) => {
      if (!entries.length || !promptId) return;

      try {
        await fetch("/api/voice/log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            sessionUuid,
            promptId,
            entries,
          }),
        });
      } catch (loggingError) {
        console.warn("[VoicePanel] failed to log voice interaction", loggingError);
      }
    },
    [promptId, sessionUuid, userId],
  );

  const handleAssistantCompletion = useCallback(
    async (responseId: string | undefined, fallbackContent: unknown) => {
      let text = "";

      if (responseId && assistantBufferRef.current.has(responseId)) {
        text = assistantBufferRef.current.get(responseId) ?? "";
        assistantBufferRef.current.delete(responseId);
      } else {
        text = extractTextFromContent(fallbackContent);
      }

      if (text.trim().length === 0) {
        return;
      }

      await logConversationEntries([{ role: "assistant", content: text.trim() }]);
    },
    [logConversationEntries],
  );

  const handleRealtimeEvent = useCallback(
    async (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const event = payload as Record<string, unknown>;
      const type = typeof event.type === "string" ? event.type : "";

      if (type === "conversation.item.created") {
        const item = event.item as Record<string, unknown> | undefined;
        if (!item) return;

        const itemId = typeof item.id === "string" ? item.id : undefined;
        if (itemId && processedItemIdsRef.current.has(itemId)) {
          return;
        }
        if (itemId) {
          processedItemIdsRef.current.add(itemId);
        }

        const role =
          item.role === "user"
            ? "user"
            : item.role === "assistant"
              ? "assistant"
              : null;

        if (role !== "user") {
          return;
        }

        const text = extractTextFromContent(item.content);
        if (text.trim().length === 0) {
          return;
        }

        await logConversationEntries([{ role: "user", content: text.trim() }]);
        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = typeof event.transcript === "string" ? event.transcript : "";
        if (transcript.trim().length > 0) {
          await logConversationEntries([{ role: "user", content: transcript.trim() }]);
        }
        return;
      }

      if (type === "response.output_text.delta") {
        const responseId = typeof event.response_id === "string" ? event.response_id : undefined;
        const delta = extractTextFromContent(event.delta ?? event);
        if (!responseId || delta.length === 0) {
          return;
        }
        const buffer = assistantBufferRef.current.get(responseId) ?? "";
        assistantBufferRef.current.set(responseId, buffer + delta);
        return;
      }

      if (type === "response.output_text.done") {
        const responseId = typeof event.response_id === "string" ? event.response_id : undefined;
        await handleAssistantCompletion(responseId, event.output_text ?? event);
        return;
      }

      if (type === "response.completed") {
        const response = event.response as Record<string, unknown> | undefined;
        const responseId = response && typeof response.id === "string" ? response.id : undefined;
        await handleAssistantCompletion(responseId, response);
        return;
      }
    },
    [handleAssistantCompletion, logConversationEntries],
  );

  const connect = useCallback(async () => {
    try {
      if (!promptId) {
        throw new Error("Prompt is unavailable. Configure it in /config first.");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser does not support microphone access.");
      }

      setStatus("connecting");
      setError(null);

      const tokenResponse = await fetch("/api/realtime/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionUuid,
          userId,
          promptId,
        }),
      });

      if (!tokenResponse.ok) {
        const message = await tokenResponse
          .json()
          .catch(() => ({ error: "Unable to fetch realtime token" }));

        const errorText =
          typeof message?.error === "string"
            ? message.error
            : typeof message?.details === "string"
              ? message.details
              : "Unable to fetch realtime token";

        throw new Error(errorText);
      }

      const session = await tokenResponse.json();
      const ephemeralKey: string | undefined = session?.client_secret?.value;
      const model: string =
        typeof session?.model === "string"
          ? session.model
          : "gpt-4o-realtime-preview";

      if (!ephemeralKey) {
        throw new Error("Realtime session missing client secret.");
      }

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = localStream;

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      peerConnection.ontrack = (event) => {
        if (!audioRef.current) return;
        const [remoteStream] = event.streams;
        if (remoteStream) {
          audioRef.current.srcObject = remoteStream;
        }
      };

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannel.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          void handleRealtimeEvent(parsed);
        } catch {
          console.debug("[VoicePanel] non-JSON realtime event", event.data);
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1",
          },
          body: offer.sdp,
        },
      );

      if (!sdpResponse.ok) {
        throw new Error("Realtime session rejected SDP offer.");
      }

      const answer = await sdpResponse.text();
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answer,
      });

      setStatus("connected");
    } catch (err) {
      console.error("[VoicePanel] connect failed", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
      disconnect();
    }
  }, [disconnect, handleRealtimeEvent, promptId, sessionUuid, userId]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const isBusy = status === "connecting";
  const isConnected = status === "connected";
  const promptUnavailable = !promptId;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Voice Panel</h3>
          <p className="text-xs text-muted-foreground">
            Connect to the realtime voice assistant over WebRTC.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
          {isConnected ? (
            <button
              type="button"
              className="w-full rounded-md bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
              onClick={disconnect}
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70 sm:w-auto"
              onClick={connect}
              disabled={isBusy || promptUnavailable}
            >
              {isBusy ? "Connecting…" : "Connect"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <audio ref={audioRef} autoPlay playsInline controls className="w-full" />
        <p className="text-xs text-muted-foreground">
          Status: {" "}
          <span className="font-medium capitalize">
            {status === "idle" ? "idle" : status}
          </span>
        </p>
        {promptUnavailable ? (
          <p className="text-xs text-muted-foreground">
            Configure the assistant prompt before starting a voice session.
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
