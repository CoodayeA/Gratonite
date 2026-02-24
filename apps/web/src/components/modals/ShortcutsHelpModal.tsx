import { Modal } from '@/components/ui/Modal';
import { groupShortcutsByCategory, formatShortcut } from '@/lib/keyboardShortcuts';

export function ShortcutsHelpModal() {
  const groups = groupShortcutsByCategory();

  return (
    <Modal id="shortcuts-help" title="Keyboard Shortcuts" size="md">
      <div className="shortcuts-help-content">
        {Array.from(groups.entries()).map(([category, shortcuts]) => (
          <div key={category} className="shortcuts-category">
            <h3 className="shortcuts-category-title">{category}</h3>
            <div className="shortcuts-list">
              {shortcuts.map((def) => (
                <div key={def.action} className="shortcuts-row">
                  <span className="shortcuts-label">{def.label}</span>
                  <kbd className="shortcuts-keys">{formatShortcut(def)}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
