import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, FileText, X, Folder, File, ChevronRight, ArrowUp } from 'lucide-react'

interface FileItem {
  name: string
  type: 'file' | 'folder'
  children?: FileItem[]
  isOpen?: boolean
  path?: string
  size?: number
  modified?: string
}

interface LauncherItem {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  action: () => void
}

interface UlauncherProps {
  isVisible: boolean
  onClose: () => void
  onOpenFile: (fileName: string) => void
  onCreateFile: () => void
  onOpenFileDialog: () => void
  onOpenFolderDialog: () => void
  onListFiles: (path: string) => Promise<FileItem[]>
}

export function Ulauncher({ 
  isVisible, 
  onClose, 
  onOpenFile, 
  onCreateFile, 
  onOpenFileDialog,
  onOpenFolderDialog,
  onListFiles
}: UlauncherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mode, setMode] = useState<'actions' | 'browser'>('actions')
  const [browserPath, setBrowserPath] = useState('')
  const [browserFiles, setBrowserFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const actions: LauncherItem[] = [
    {
      id: 'open-file',
      title: 'Open File...',
      description: 'Open a file from your system',
      icon: <File size={20} />,
      action: onOpenFileDialog
    },
    {
      id: 'open-folder',
      title: 'Open Folder...',
      description: 'Open a folder/project from your system',
      icon: <Folder size={20} />,
      action: onOpenFolderDialog
    },
    {
      id: 'file-browser',
      title: 'File Browser',
      description: 'Browse files and directories',
      icon: <Folder size={20} />,
      action: () => {
        setMode('browser')
        const startPath = '/home'
        setBrowserPath(startPath)
        loadBrowserFiles(startPath)
      }
    },
    {
      id: 'new-file',
      title: 'New File',
      description: 'Create a new file in the editor',
      icon: <FileText size={20} />,
      action: onCreateFile
    }
  ]

  const loadBrowserFiles = async (path: string) => {
    setIsLoading(true)
    try {
      const fileList = await onListFiles(path)
      setBrowserFiles(fileList.slice(0, 100))
    } catch (error) {
      console.error('Error loading files:', error)
      setBrowserFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  const navigateTo = async (path: string) => {
    setBrowserPath(path)
    await loadBrowserFiles(path)
    setSelectedIndex(0)
  }

  const goUp = () => {
    const parentPath = browserPath.split('/').slice(0, -1).join('/') || '/'
    navigateTo(parentPath)
  }

  const filteredActions = actions.filter(action =>
    action.title.toLowerCase().includes(query.toLowerCase()) ||
    action.description.toLowerCase().includes(query.toLowerCase())
  )

  const filteredBrowserFiles = useMemo(() => {
    return browserFiles.filter(file =>
      file.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 50)
  }, [browserFiles, query])

  const getCurrentItems = () => {
    if (mode === 'browser') return filteredBrowserFiles
    return filteredActions
  }

  const currentItems = getCurrentItems()

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setSelectedIndex(0)
      setMode('actions')
    }
  }, [isVisible])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, mode])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, currentItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (mode === 'browser') {
        const file = filteredBrowserFiles[selectedIndex]
        if (file) {
          if (file.type === 'folder') {
            navigateTo(file.path || `${browserPath}/${file.name}`)
          } else {
            onOpenFile(file.path || `${browserPath}/${file.name}`)
            onClose()
          }
        }
      } else {
        const action = filteredActions[selectedIndex]
        if (action) {
          action.action()
          if (action.id !== 'file-browser') {
            onClose()
          }
        }
      }
    } else if (e.key === 'Escape') {
      if (mode === 'browser') {
        setMode('actions')
        setQuery('')
      } else {
        onClose()
      }
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-32 z-50">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search size={20} className="text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder={
              mode === 'browser' ? 'Search directory...' : 
              'Type to search...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-lg placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-2">
            {mode === 'browser' && (
              <>
                <button
                  onClick={goUp}
                  className="px-2 py-1 text-xs bg-accent rounded flex items-center gap-1"
                >
                  <ArrowUp size={12} />
                  Up
                </button>
                <span className="text-xs text-muted-foreground">{browserPath}</span>
              </>
            )}
            {(mode === 'browser') && (
              <button
                onClick={() => {
                  setMode('actions')
                  setQuery('')
                }}
                className="px-2 py-1 text-xs bg-accent rounded"
              >
                Back
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search size={48} className="mx-auto mb-4 opacity-50 animate-pulse" />
              <p>Loading files...</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {mode === 'browser' ? (
                <div>
                  <Folder size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Empty directory</p>
                </div>
              ) : (
                `No results found for "${query}"`
              )}
            </div>
          ) : (
            <>
              {mode === 'browser' && browserFiles.length >= 100 && (
                <div className="p-2 text-xs text-center text-orange-500 bg-orange-500/10 border-b border-border">
                  Showing first 100 files. Use search to find specific files.
                </div>
              )}
              {currentItems.map((item, index) => {
                if (mode === 'browser') {
                  const file = item as FileItem
                  return (
                    <div
                      key={file.name}
                      className={`flex items-center gap-4 p-3 cursor-pointer transition-colors font-mono text-sm ${
                        index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                      }`}
                      onClick={() => {
                        if (file.type === 'folder') {
                          navigateTo(file.path || `${browserPath}/${file.name}`)
                        } else {
                          onOpenFile(file.path || `${browserPath}/${file.name}`)
                          onClose()
                        }
                      }}
                    >
                      <div className="text-primary">
                        {file.type === 'file' ? <File size={16} /> : <Folder size={16} />}
                      </div>
                      <div className="flex-1">
                        <span>{file.name}</span>
                        {file.type === 'folder' && <span className="text-muted-foreground">/</span>}
                      </div>
                      {file.type === 'folder' && (
                        <ChevronRight size={14} className="text-muted-foreground" />
                      )}
                    </div>
                  )
                } else {
                  const action = item as LauncherItem
                  return (
                    <div
                      key={action.id}
                      className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                        index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                      }`}
                      onClick={() => {
                        action.action()
                        if (action.id !== 'file-browser') {
                          onClose()
                        }
                      }}
                    >
                      <div className="text-primary">{action.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium">{action.title}</div>
                        <div className="text-sm text-muted-foreground">{action.description}</div>
                      </div>
                    </div>
                  )
                }
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}