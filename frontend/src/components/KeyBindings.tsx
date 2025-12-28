import { X } from 'lucide-react'

interface KeyBindingsProps {
  isVisible: boolean
  onClose: () => void
}

interface KeyBinding {
  category: string
  shortcuts: {
    keys: string
    description: string
  }[]
}

const keyBindings: KeyBinding[] = [
  {
    category: 'File Operations',
    shortcuts: [
      { keys: 'Ctrl+N', description: 'New File' },
      { keys: 'Ctrl+O', description: 'Open File' },
      { keys: 'Ctrl+S', description: 'Save File' },
      { keys: 'Ctrl+Shift+S', description: 'Save As' },
      { keys: 'Ctrl+W', description: 'Close Tab' },
      { keys: 'Ctrl+P', description: 'Quick File Search' },
      { keys: 'Ctrl+Shift+N', description: 'New Folder' }
    ]
  },
  {
    category: 'Editor',
    shortcuts: [
      { keys: 'Ctrl+Z', description: 'Undo' },
      { keys: 'Ctrl+Y', description: 'Redo' },
      { keys: 'Ctrl+X', description: 'Cut' },
      { keys: 'Ctrl+C', description: 'Copy' },
      { keys: 'Ctrl+V', description: 'Paste' },
      { keys: 'Ctrl+A', description: 'Select All' },
      { keys: 'Ctrl+F', description: 'Find' },
      { keys: 'Ctrl+H', description: 'Replace' },
      { keys: 'F3', description: 'Find Next' },
      { keys: 'Shift+F3', description: 'Find Previous' }
    ]
  },
  {
    category: 'Navigation',
    shortcuts: [
      { keys: 'Ctrl+B', description: 'Toggle File Explorer' },
      { keys: 'Ctrl+Space', description: 'Command Palette' },
      { keys: 'F11', description: 'Toggle Fullscreen' },
      { keys: 'Alt+Enter', description: 'Enter Fullscreen' }
    ]
  },
  {
    category: 'Application',
    shortcuts: [
      { keys: 'F1', description: 'Show Keyboard Shortcuts' },
      { keys: 'Ctrl+Q', description: 'Exit Application' }
    ]
  }
]

export function KeyBindings({ isVisible, onClose }: KeyBindingsProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {keyBindings.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-4">
                <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                  {category.category}
                </h3>
                <div className="space-y-3">
                  {category.shortcuts.map((shortcut, shortcutIndex) => (
                    <div key={shortcutIndex} className="flex items-center justify-between">
                      <span className="text-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.split('+').map((key, keyIndex) => (
                          <span key={keyIndex} className="flex items-center">
                            <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono text-muted-foreground">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.split('+').length - 1 && (
                              <span className="mx-1 text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Note:</strong> Use <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">Cmd</kbd> instead of <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">Ctrl</kbd> on macOS
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}