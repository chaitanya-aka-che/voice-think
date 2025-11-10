import { deletePromptContext, savePrompt, savePromptContext } from "../../modules/config/actions";
import { getPrompts } from "../../modules/config/queries";

export default async function ConfigPage() {
  const prompts = await getPrompts();
  const prompt = prompts[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Assistant Prompt</h1>
          <p className="text-sm text-muted-foreground">
            Maintain a single source of truth for the assistant&apos;s behaviour. Updates apply immediately to both chat
            and voice interactions.
          </p>
        </header>

        <form action={savePrompt} className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-medium">
            {prompt ? "Edit assistant prompt" : "Create assistant prompt"}
          </h2>
          {prompt ? <input type="hidden" name="id" value={prompt.id} /> : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Name</span>
              <input
                name="name"
                required
                defaultValue={prompt?.name ?? ""}
                className="rounded-md border border-border bg-background px-3 py-2"
                placeholder="Daily alignment coach"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Description</span>
              <input
                name="description"
                defaultValue={prompt?.description ?? ""}
                className="rounded-md border border-border bg-background px-3 py-2"
                placeholder="Used for morning drive rituals"
              />
            </label>
          </div>
          <label className="mt-4 flex flex-col gap-2">
            <span className="text-sm font-medium">System prompt</span>
            <textarea
              name="systemPrompt"
              required
              rows={6}
              defaultValue={prompt?.system_prompt ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="You are a reflective coach..."
            />
          </label>
          <label className="mt-4 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={prompt?.is_active ?? true}
              className="h-4 w-4"
            />
            Prompt is active
          </label>
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save prompt
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-8">
        {!prompt ? (
          <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            Create the assistant prompt above to configure supporting contexts.
          </p>
        ) : (
          <article className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{prompt.name}</h3>
              <p className="text-sm text-muted-foreground">{prompt.description ?? "No description"}</p>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Context definitions
              </h4>

              {prompt.prompt_contexts.length === 0 ? (
                <p className="rounded border border-dashed border-border p-4 text-xs text-muted-foreground">
                  No contexts yet for this prompt.
                </p>
              ) : (
                <ul className="space-y-3">
                  {prompt.prompt_contexts.map((context) => (
                      <li
                        key={context.id}
                        className="flex flex-col gap-3 rounded border border-border bg-background p-4 sm:p-5"
                      >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{context.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {context.description ?? "No description"}
                          </p>
                        </div>
                        <form action={deletePromptContext}>
                          <input type="hidden" name="id" value={context.id} />
                          <button className="text-xs text-destructive hover:underline" type="submit">
                            Delete
                          </button>
                        </form>
                      </div>
                      <details className="rounded border border-dashed border-border bg-card p-3">
                        <summary className="cursor-pointer text-xs font-medium uppercase text-muted-foreground">
                          Payload
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                          {JSON.stringify(context.context_payload, null, 2)}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>

              <form action={savePromptContext} className="space-y-4 rounded-md border border-border bg-background p-4 sm:p-5">
              <h5 className="text-sm font-semibold">Add context</h5>
              <input type="hidden" name="promptId" value={prompt.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    name="name"
                    required
                    className="rounded-md border border-border bg-card px-3 py-2"
                    placeholder="Daily goals snapshot"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Description</span>
                  <input
                    name="description"
                    className="rounded-md border border-border bg-card px-3 py-2"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Context payload (JSON)</span>
                <textarea
                  name="contextPayload"
                  rows={4}
                  className="rounded-md border border-border bg-card px-3 py-2 text-xs"
                  placeholder='{"source": "user_goals"}'
                />
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" name="auxSchemaRequired" className="h-4 w-4" />
                Requires auxiliary schema
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save context
                </button>
              </div>
            </form>
          </article>
        )}
      </section>
    </div>
  );
}
