import { useTodos } from "@/hooks/useTodos";
import { useNotes } from "@/hooks/useNotes";
import { useHiddenWidgets } from "@/hooks/useHiddenWidgets";
import { TodoWidget } from "@/widgets/stats/TodoWidget";
import { NotepadWidget } from "@/widgets/stats/NotepadWidget";

type Props = { userId: string };

export default function Shed({ userId }: Props) {
  const todos = useTodos(userId);
  const notes = useNotes(userId);
  const widgets = useHiddenWidgets(userId);

  const showTodo = !widgets.hidden.has("shed:todo");
  const showNotes = !widgets.hidden.has("shed:notepad");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shed</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Tools, plans, and scraps — your to-do list and a notepad for
          anything on your mind.
        </p>
      </div>

      {(showTodo || showNotes) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {showTodo && (
            <TodoWidget
              userId={userId}
              todos={todos.todos}
              onChanged={todos.reload}
            />
          )}
          {showNotes && (
            <NotepadWidget
              userId={userId}
              notes={notes.notes}
              onChanged={notes.reload}
            />
          )}
        </div>
      )}
    </div>
  );
}
