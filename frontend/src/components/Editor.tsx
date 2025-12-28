import { useState, useRef, useEffect } from 'react'
import { File, Folder, FolderOpen, X, FileText, Menu, Zap, FilePlus, FolderPlus, ChevronLeft, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'
import MonacoEditor from '@monaco-editor/react'
import { Ulauncher } from './Ulauncher'
import { FileBrowser } from './FileBrowser'
import { KeyBindings } from './KeyBindings'
import { ReadFile, WriteFile, CreateFolder, ListFiles, SetCurrentProject, GetCurrentProject, OpenFileDialog, OpenDirectoryDialog, SaveFileDialog, ToggleFullscreen } from '../../wailsjs/go/main/App'

interface FileItem {
  name: string
  type: 'file' | 'folder'
  children?: FileItem[]
  isOpen?: boolean
  path?: string
  size?: number
  modified?: string
}

interface Tab {
  id: string
  name: string
  content: string
  isDirty: boolean
  filePath?: string
}

interface MenuDropdownProps {
  isOpen: boolean
  onClose: () => void
  items: ({ label: string; action?: () => void } | { separator: true })[]
  position: { x: number; y: number }
}

function MenuDropdown({ isOpen, onClose, items, position }: MenuDropdownProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div 
        className="absolute z-20 bg-popover border border-border rounded-lg shadow-xl py-2 min-w-52"
        style={{ left: position.x, top: position.y }}
      >
        {items.map((item, index) => (
          'separator' in item ? (
            <div key={index} className="border-t border-border mx-2 my-1" />
          ) : (
            <div 
              key={index} 
              className="px-4 py-2 hover:bg-accent cursor-pointer text-sm transition-colors"
              onClick={() => {
                item.action?.()
                onClose()
              }}
            >
              <span className="text-foreground">{item.label}</span>
            </div>
          )
        ))}
      </div>
    </>
  )
}

export function Editor() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [showLauncher, setShowLauncher] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [showFileExplorer, setShowFileExplorer] = useState(false)
  const [untitledCounter, setUntitledCounter] = useState(1)
  const [currentProject, setCurrentProject] = useState('')
  const monacoRef = useRef<any>(null)
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [creatingItem, setCreatingItem] = useState<{type: 'file' | 'folder', parentPath: string} | null>(null)
  const [renamingItem, setRenamingItem] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showAbout, setShowAbout] = useState(false)
  const [showKeyBindings, setShowKeyBindings] = useState(false)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, type: 'editor' | 'explorer', item?: FileItem} | null>(null)
  const [autoSave, setAutoSave] = useState(false)
  const autoSaveIntervalRef = useRef<number | null>(null)

  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 })

  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': case 'jsx': return 'javascript'
      case 'ts': case 'tsx': return 'typescript'
      case 'py': return 'python'
      case 'go': return 'go'
      case 'rs': return 'rust'
      case 'java': return 'java'
      case 'cpp': case 'cc': case 'cxx': return 'cpp'
      case 'c': return 'c'
      case 'cs': return 'csharp'
      case 'php': return 'php'
      case 'rb': return 'ruby'
      case 'html': return 'html'
      case 'css': return 'css'
      case 'scss': return 'scss'
      case 'json': return 'json'
      case 'xml': return 'xml'
      case 'yaml': case 'yml': return 'yaml'
      case 'md': return 'markdown'
      case 'sql': return 'sql'
      case 'sh': case 'bash': return 'shell'
      default: return 'plaintext'
    }
  }

  const menuItems = {
    File: [
      { label: 'New File', action: () => createNewFile() },
      { label: 'New Folder', action: () => {
        setCreatingItem({ type: 'folder', parentPath: selectedFolder || currentProject })
        setInputValue('')
      } },
      { separator: true as const },
      { label: 'Open File...', action: () => openFile() },
      { label: 'Open Folder...', action: () => openFolder() },
      { separator: true as const },
      { label: 'Save', action: () => saveCurrentFile() },
      { label: 'Save As...', action: () => saveFileAs() },
      { label: `Auto Save ${autoSave ? '✓' : ''}`, action: () => toggleAutoSave() },
      { separator: true as const },
      { label: 'Close Folder', action: () => {
        setCurrentProject('')
        setSelectedFolder('')
        setFiles([])
        setTabs([])
        setActiveTab('')
        setShowFileExplorer(false)
      }},
      { label: 'Close', action: () => closeCurrentTab() },
      { label: 'Exit', action: () => window.close() }
    ],
    Edit: [
      { label: 'Undo', action: () => monacoRef.current?.trigger('keyboard', 'undo', null) },
      { label: 'Redo', action: () => monacoRef.current?.trigger('keyboard', 'redo', null) },
      { separator: true as const },
      { label: 'Cut', action: () => monacoRef.current?.trigger('keyboard', 'editor.action.clipboardCutAction', null) },
      { label: 'Copy', action: () => monacoRef.current?.trigger('keyboard', 'editor.action.clipboardCopyAction', null) },
      { label: 'Paste', action: () => monacoRef.current?.trigger('keyboard', 'editor.action.clipboardPasteAction', null) },
      { separator: true as const },
      { label: 'Select All', action: () => monacoRef.current?.trigger('keyboard', 'editor.action.selectAll', null) },
      { separator: true as const },
      { label: 'Find', action: () => monacoRef.current?.trigger('keyboard', 'actions.find', null) },
      { label: 'Replace', action: () => monacoRef.current?.trigger('keyboard', 'editor.action.startFindReplaceAction', null) },
      { label: 'Find Next', action: () => monacoRef.current?.trigger('keyboard', 'editor.action.nextMatchFindAction', null) },
      { label: 'Find Previous', action: () => monacoRef.current?.trigger('keyboard', 'editor.action.previousMatchFindAction', null) }
    ],
    Help: [
      { label: 'Keyboard Shortcuts', action: () => setShowKeyBindings(true) },
      { separator: true as const },
      { label: 'About SoneT', action: () => setShowAbout(true) }
    ]
  }

  const handleMenuClick = (menuName: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setMenuPosition({ x: rect.left, y: rect.bottom })
    setActiveMenu(activeMenu === menuName ? null : menuName)
  }

  const createNewFile = async () => {
    const fileName = `Untitled-${untitledCounter}`
    const newTab: Tab = {
      id: Date.now().toString(),
      name: fileName,
      content: '',
      isDirty: true
    }
    setTabs([...tabs, newTab])
    setActiveTab(newTab.id)
    setUntitledCounter(prev => prev + 1)
  }

  const handleCreateItem = async (name: string) => {
    if (!creatingItem || !name.trim()) return
    
    try {
      const targetPath = `${creatingItem.parentPath}/${name.trim()}`
      
      if (creatingItem.type === 'file') {
        await WriteFile(targetPath, '')
        await openFileFromPath(targetPath)
      } else {
        await CreateFolder(targetPath)
      }
      
      await refreshFileList()
    } catch (error) {
      console.error(`Error creating ${creatingItem.type}:`, error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg.includes('permission') || errorMsg.includes('Permission')) {
        alert(`Permission denied: Cannot create ${creatingItem.type} in this location. Please check file permissions.`)
      } else if (errorMsg.includes('already exists')) {
        alert(`${creatingItem.type} already exists with that name.`)
      } else {
        alert(`Error creating ${creatingItem.type}: ${errorMsg}`)
      }
    } finally {
      setCreatingItem(null)
      setInputValue('')
    }
  }

  const handleRename = async (newName: string, oldPath: string) => {
    if (!newName.trim() || !renamingItem) return
    
    try {
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'))
      const newPath = `${parentPath}/${newName.trim()}`
      
      // For simplicity, we'll create new and delete old (Wails doesn't have rename)
      const isFile = !oldPath.endsWith('/')
      
      if (isFile) {
        const content = await ReadFile(oldPath)
        await WriteFile(newPath, content)
      } else {
        await CreateFolder(newPath)
      }
      
      await refreshFileList()
    } catch (error) {
      alert(`Error renaming: ${error}`)
    } finally {
      setRenamingItem(null)
      setInputValue('')
    }
  }

  const openFile = async () => {
    try {
      const filePath = await OpenFileDialog()
      if (filePath) {
        await openFileFromPath(filePath)
      }
    } catch (error) {
      console.error('Error opening file:', error)
    }
  }

  const openFolder = async () => {
    try {
      const folderPath = await OpenDirectoryDialog()
      if (folderPath) {
        setCurrentProject(folderPath)
        await SetCurrentProject(folderPath)
        setShowFileExplorer(true)
        setSelectedFolder(folderPath)
        await refreshFileList()
      }
    } catch (error) {
      console.error('Error opening folder:', error)
    }
  }

  const saveCurrentFile = async () => {
    const currentTab = tabs.find(tab => tab.id === activeTab)
    if (currentTab) {
      try {
        if (currentTab.name.startsWith('Untitled') || !currentTab.filePath) {
          await saveFileAs()
        } else {
          await WriteFile(currentTab.filePath, currentTab.content)
          setTabs(tabs.map(tab => 
            tab.id === activeTab ? { ...tab, isDirty: false } : tab
          ))
          await refreshFileList()
        }
      } catch (error) {
        console.error('Error saving file:', error)
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (errorMsg.includes('permission') || errorMsg.includes('Permission') || errorMsg.includes('read-only')) {
          alert(`Permission denied: Cannot save file. Please check file permissions or try saving to a different location.`)
        } else {
          alert(`Error saving file: ${errorMsg}`)
        }
      }
    }
  }

  const saveFileAs = async () => {
    const currentTab = tabs.find(tab => tab.id === activeTab)
    if (currentTab) {
      try {
        const filePath = await SaveFileDialog(currentTab.name.startsWith('Untitled') ? '' : currentTab.name)
        if (filePath) {
          await WriteFile(filePath, currentTab.content)
          const fileName = filePath.split('/').pop() || filePath
          setTabs(tabs.map(tab => 
            tab.id === activeTab ? { ...tab, name: fileName, filePath: filePath, isDirty: false } : tab
          ))
          await refreshFileList()
        }
      } catch (error) {
        console.error('Error saving file:', error)
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (errorMsg.includes('permission') || errorMsg.includes('Permission') || errorMsg.includes('read-only')) {
          alert(`Permission denied: Cannot save file to selected location. Please choose a different location or check permissions.`)
        } else {
          alert(`Error saving file: ${errorMsg}`)
        }
      }
    }
  }

  const saveRecentFiles = (files: string[]) => {
    localStorage.setItem('sonet-recent-files', JSON.stringify(files))
  }

  const loadRecentFiles = () => {
    try {
      const saved = localStorage.getItem('sonet-recent-files')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  const toggleAutoSave = () => {
    const newAutoSave = !autoSave
    setAutoSave(newAutoSave)
    localStorage.setItem('sonet-auto-save', JSON.stringify(newAutoSave))
    
    if (newAutoSave) {
      startAutoSave()
    } else {
      stopAutoSave()
    }
  }

  const startAutoSave = () => {
    if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current)
    autoSaveIntervalRef.current = setInterval(() => {
      const currentTab = tabs.find(tab => tab.id === activeTab)
      if (currentTab && currentTab.isDirty && currentTab.filePath && !currentTab.name.startsWith('Untitled')) {
        saveCurrentFile()
      }
    }, 2000) // Auto-save every 2 seconds
  }

  const stopAutoSave = () => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current)
      autoSaveIntervalRef.current = null
    }
  }

  const openFileFromPath = async (filePath: string) => {
    try {
      const content = await ReadFile(filePath)
      const fileName = filePath.split('/').pop() || filePath
      
      // Add to recent files
      const updatedRecentFiles = [filePath, ...recentFiles.filter(f => f !== filePath)].slice(0, 10)
      setRecentFiles(updatedRecentFiles)
      saveRecentFiles(updatedRecentFiles)
      
      const existingTab = tabs.find(tab => tab.filePath === filePath)
      if (existingTab) {
        setActiveTab(existingTab.id)
      } else {
        const newTab: Tab = {
          id: Date.now().toString(),
          name: fileName,
          content,
          isDirty: false,
          filePath: filePath
        }
        setTabs([...tabs, newTab])
        setActiveTab(newTab.id)
      }
    } catch (error) {
      alert(`Error opening file: ${error}`)
    }
  }

  const refreshFileList = async () => {
    if (currentProject) {
      try {
        const fileList = await ListFiles(currentProject)
        const items: FileItem[] = fileList.map(file => ({
          name: file.name,
          type: file.isDir ? 'folder' : 'file',
          path: file.path,
          size: file.size,
          modified: file.modified,
          isOpen: false,
          children: file.isDir ? [] : undefined
        }))
        setFiles(items)
      } catch (error) {
        console.error('Error loading files:', error)
      }
    }
  }

  const loadFolderChildren = async (folderPath: string): Promise<FileItem[]> => {
    try {
      const fileList = await ListFiles(folderPath)
      return fileList.map(file => ({
        name: file.name,
        type: file.isDir ? 'folder' : 'file',
        path: file.path,
        size: file.size,
        modified: file.modified,
        isOpen: false,
        children: file.isDir ? [] : undefined
      }))
    } catch (error) {
      console.error('Error loading folder:', error)
      return []
    }
  }

  const renderFileTree = (items: FileItem[], depth = 0) => {
    const result = []
    
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      
      result.push(
        <div key={index}>
          <div 
            className={`flex items-center gap-1 px-2 py-1 hover:bg-accent cursor-pointer text-sm group ${
              selectedFolder === item.path ? 'bg-accent' : ''
            }`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={async () => {
              if (item.type === 'folder') {
                setSelectedFolder(item.path || '')
                const updatedFiles = await toggleFolder(item.name, item.path || '', files)
                setFiles(updatedFiles)
              } else {
                openFileFromPath(item.path || '')
              }
            }}
            onDoubleClick={() => {
              setRenamingItem(item.path || '')
              setInputValue(item.name)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                type: 'explorer',
                item
              })
            }}
          >
            {item.type === 'folder' && (
              <div className="w-3 h-3 flex items-center justify-center">
                {item.isOpen ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            )}
            
            {item.type === 'folder' ? (
              item.isOpen ? <FolderOpen size={16} className="text-blue-400" /> : <Folder size={16} className="text-blue-400" />
            ) : (
              <File size={16} className="text-gray-400" />
            )}
            
            {renamingItem === item.path ? (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={() => handleRename(inputValue, item.path || '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename(inputValue, item.path || '')
                  } else if (e.key === 'Escape') {
                    setRenamingItem(null)
                    setInputValue('')
                  }
                }}
                className="flex-1 bg-background border-0 outline-none px-1 text-sm"
                autoFocus
              />
            ) : (
              <span className="flex-1">{item.name}</span>
            )}
            
            {item.type === 'folder' && renamingItem !== item.path && (
              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCreatingItem({ type: 'file', parentPath: item.path || '' })
                    setInputValue('')
                  }}
                  className="p-1 hover:bg-muted rounded"
                  title="New File"
                >
                  <FilePlus size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCreatingItem({ type: 'folder', parentPath: item.path || '' })
                    setInputValue('')
                  }}
                  className="p-1 hover:bg-muted rounded"
                  title="New Folder"
                >
                  <FolderPlus size={14} />
                </button>
              </div>
            )}
          </div>
          
          {item.type === 'folder' && item.isOpen && item.children && (
            <div>
              {renderFileTree(item.children, depth + 1)}
              {creatingItem && creatingItem.parentPath === item.path && (
                <div 
                  className="flex items-center gap-1 px-2 py-1 text-sm"
                  style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
                >
                  {creatingItem.type === 'folder' ? (
                    <Folder size={16} className="text-blue-400" />
                  ) : (
                    <File size={16} className="text-gray-400" />
                  )}
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={() => handleCreateItem(inputValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateItem(inputValue)
                      } else if (e.key === 'Escape') {
                        setCreatingItem(null)
                        setInputValue('')
                      }
                    }}
                    className="flex-1 bg-background border-0 outline-none px-1 text-sm"
                    placeholder={`${creatingItem.type} name`}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )
    }
    
    // Add creation input at root level
    if (depth === 0 && creatingItem && creatingItem.parentPath === currentProject) {
      result.push(
        <div 
          key="creating"
          className="flex items-center gap-1 px-2 py-1 text-sm"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {creatingItem.type === 'folder' ? (
            <Folder size={16} className="text-blue-400" />
          ) : (
            <File size={16} className="text-gray-400" />
          )}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => handleCreateItem(inputValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateItem(inputValue)
              } else if (e.key === 'Escape') {
                setCreatingItem(null)
                setInputValue('')
              }
            }}
            className="flex-1 bg-background border-0 outline-none px-1 text-sm"
            placeholder={`${creatingItem.type} name`}
            autoFocus
          />
        </div>
      )
    }
    
    return result
  }

  const toggleFolder = async (folderName: string, folderPath: string, items: FileItem[]): Promise<FileItem[]> => {
    const updateItems = async (itemList: FileItem[]): Promise<FileItem[]> => {
      const result = []
      for (const item of itemList) {
        if (item.name === folderName && item.type === 'folder' && item.path === folderPath) {
          if (!item.isOpen && (!item.children || item.children.length === 0)) {
            const children = await loadFolderChildren(item.path || '')
            result.push({ ...item, isOpen: true, children })
          } else {
            result.push({ ...item, isOpen: !item.isOpen })
          }
        } else if (item.children) {
          const updatedChildren = await updateItems(item.children)
          result.push({ ...item, children: updatedChildren })
        } else {
          result.push(item)
        }
      }
      return result
    }
    return updateItems(items)
  }

  const closeCurrentTab = () => {
    if (activeTab) {
      setTabs(tabs.filter(tab => tab.id !== activeTab))
      const remainingTabs = tabs.filter(tab => tab.id !== activeTab)
      if (remainingTabs.length > 0) {
        setActiveTab(remainingTabs[remainingTabs.length - 1].id)
      } else {
        setActiveTab('')
      }
    }
  }

  const updateCursorPosition = (editor: any) => {
    if (editor) {
      const position = editor.getPosition()
      if (position) {
        setCursorPosition({ line: position.lineNumber, col: position.column })
      }
    }
  }

  const handleContentChange = (value: string | undefined) => {
    if (activeTab && value !== undefined) {
      setTabs(tabs.map(tab => 
        tab.id === activeTab 
          ? { ...tab, content: value, isDirty: true }
          : tab
      ))
    }
  }

  const handleEditorMount = (editor: any, monaco: any) => {
    monacoRef.current = editor
    editor.onDidChangeCursorPosition(() => updateCursorPosition(editor))
    
    // Create models for each tab
    editor.onDidChangeModel(() => {
      const model = editor.getModel()
      if (model && activeTab) {
        // Model tracking for future use
      }
    })
    
    // Define custom dark theme
    monaco.editor.defineTheme('sonet-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'operator', foreground: 'D4D4D4' }
      ],
      colors: {
        'editor.background': '#0D1117',
        'editor.foreground': '#E6EDF3',
        'editor.lineHighlightBackground': '#161B22',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorCursor.foreground': '#FFFFFF',
        'editorLineNumber.foreground': '#6E7681',
        'editorLineNumber.activeForeground': '#E6EDF3',
        'editor.selectionHighlightBackground': '#ADD6FF26'
      }
    })
    
    monaco.editor.setTheme('sonet-dark')
  }

  // Load current project and settings on mount
  useEffect(() => {
    const loadCurrentProject = async () => {
      try {
        const project = await GetCurrentProject()
        if (project) {
          setCurrentProject(project)
          setSelectedFolder(project)
          setShowFileExplorer(true)
          await refreshFileList()
        }
      } catch (error) {
        console.error('Error loading current project:', error)
      }
    }
    
    // Load recent files
    setRecentFiles(loadRecentFiles())
    
    // Load auto-save setting
    try {
      const savedAutoSave = localStorage.getItem('sonet-auto-save')
      if (savedAutoSave) {
        const autoSaveEnabled = JSON.parse(savedAutoSave)
        setAutoSave(autoSaveEnabled)
        if (autoSaveEnabled) {
          startAutoSave()
        }
      }
    } catch {
      // Ignore errors
    }
    
    loadCurrentProject()
  }, [])

  // Auto-refresh when currentProject changes
  useEffect(() => {
    if (currentProject) {
      refreshFileList()
    }
  }, [currentProject])

  // Auto-save effect
  useEffect(() => {
    if (autoSave) {
      startAutoSave()
    } else {
      stopAutoSave()
    }
    
    return () => stopAutoSave()
  }, [autoSave, tabs, activeTab])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle F11 for fullscreen
      if (e.key === 'F11') {
        e.preventDefault()
        ToggleFullscreen()
        return
      }
      
      // Handle F1 for help
      if (e.key === 'F1') {
        e.preventDefault()
        setShowKeyBindings(true)
        return
      }
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault()
            e.stopPropagation()
            setShowFileExplorer(!showFileExplorer)
            break
          case 'n':
            e.preventDefault()
            createNewFile()
            break
          case 'o':
            e.preventDefault()
            openFile()
            break
          case 's':
            e.preventDefault()
            saveCurrentFile()
            break
          case 'w':
            e.preventDefault()
            closeCurrentTab()
            break
          case ' ':
            e.preventDefault()
            setShowLauncher(true)
            break
          case '`':
            e.preventDefault()
            break
          case 'Enter':
            if (e.altKey) {
              e.preventDefault()
              document.documentElement.requestFullscreen()
            }
            break
          case 'p':
            e.preventDefault()
            setShowFileBrowser(true)
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [showFileExplorer, activeTab])

  const currentTab = tabs.find(tab => tab.id === activeTab)

  return (
    <div 
      className="h-screen flex flex-col bg-background text-foreground"
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'b':
              e.preventDefault()
              setShowFileExplorer(!showFileExplorer)
              break
            case ' ':
              e.preventDefault()
              setShowLauncher(true)
              break
            case '`':
              e.preventDefault()
              break
            case 'p':
              e.preventDefault()
              setShowFileBrowser(true)
              break
          }
        }
      }}
      tabIndex={0}
    >
      {/* Menu Bar */}
      <div className="flex items-center h-8 bg-muted/30 border-b border-border px-2 text-sm">
        {Object.entries(menuItems).map(([menuName]) => (
          <button
            key={menuName}
            className="px-3 py-1 hover:bg-accent rounded transition-colors"
            onClick={(e) => handleMenuClick(menuName, e)}
          >
            {menuName}
          </button>
        ))}
        
        <div className="ml-auto flex items-center space-x-2">
          <button
            onClick={() => monacoRef.current?.trigger('keyboard', 'undo', null)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Undo (Ctrl+Z)"
            disabled={!activeTab}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={() => monacoRef.current?.trigger('keyboard', 'redo', null)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Redo (Ctrl+Y)"
            disabled={!activeTab}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </button>
          <button
            onClick={() => setShowFileExplorer(!showFileExplorer)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Toggle Explorer (Ctrl+B)"
          >
            <Menu className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowLauncher(true)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Command Palette (Cmd+Space)"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button
            onClick={() => ToggleFullscreen()}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Toggle Fullscreen (F11)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative">
        {/* File Explorer Overlay */}
        {showFileExplorer && (
          <div className="absolute right-0 top-0 h-full w-80 bg-card border-l border-border shadow-2xl z-50 animate-in slide-in-from-right duration-300">
            <div className="h-full flex flex-col relative">
              <div className="p-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <h2 className="text-sm font-semibold text-foreground truncate" title={currentProject}>
                      {currentProject ? currentProject.split('/').pop() : 'No Folder'}
                    </h2>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setCreatingItem({ type: 'file', parentPath: selectedFolder || currentProject })
                          setInputValue('')
                        }}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="New File"
                      >
                        <FilePlus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setCreatingItem({ type: 'folder', parentPath: selectedFolder || currentProject })
                          setInputValue('')
                        }}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="New Folder"
                      >
                        <FolderPlus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={refreshFileList}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {files.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium mb-1">No folder open</p>
                    <p className="text-xs">Open a folder to browse files</p>
                    <button
                      onClick={openFolder}
                      className="mt-3 text-xs text-primary hover:underline"
                    >
                      Open Folder
                    </button>
                  </div>
                ) : (
                  renderFileTree(files)
                )}
              </div>
              
              <button
                onClick={() => setShowFileExplorer(false)}
                className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-12 bg-background border border-r-0 border-border rounded-l-lg shadow-lg hover:bg-accent flex items-center justify-center transition-all duration-200 group"
                title="Close Explorer"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          {tabs.length > 0 && (
            <div className="flex items-center bg-muted/20 border-b border-border overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center px-4 py-2 border-r border-border cursor-pointer transition-colors min-w-0 max-w-48 ${
                    tab.id === activeTab
                      ? 'bg-background text-foreground'
                      : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate text-sm">
                    {tab.name}
                    {tab.isDirty && <span className="ml-1 text-orange-400">•</span>}
                  </span>
                  <button
                    className="ml-2 p-0.5 hover:bg-accent rounded flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      const newTabs = tabs.filter(t => t.id !== tab.id)
                      setTabs(newTabs)
                      if (tab.id === activeTab && newTabs.length > 0) {
                        setActiveTab(newTabs[newTabs.length - 1].id)
                      } else if (newTabs.length === 0) {
                        setActiveTab('')
                      }
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {currentTab ? (
              <>
                <div 
                  className="flex-1"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      type: 'editor'
                    })
                  }}
                >
                  <MonacoEditor
                    key={currentTab.name}
                    height="100%"
                    language={getLanguageFromFileName(currentTab.name)}
                    value={currentTab.content}
                    onChange={handleContentChange}
                    onMount={handleEditorMount}
                    theme="sonet-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 16,
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      renderWhitespace: 'none',
                      tabSize: 2,
                      insertSpaces: true,
                      fontFamily: 'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
                      fontLigatures: true,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      smoothScrolling: true,
                      padding: { top: 20, bottom: 20 },
                      bracketPairColorization: { enabled: true },
                      guides: {
                        indentation: true,
                        bracketPairs: true
                      },
                      contextmenu: false
                    }}
                  />
                </div>
                
                {/* Status Bar */}
                <div className="flex items-center justify-between px-4 py-1 bg-muted/30 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center space-x-4">
                    <span>Ln {cursorPosition.line}, Col {cursorPosition.col}</span>
                    <span>{currentTab.content.length} characters</span>
                    <span>{currentTab.content.split('\n').length} lines</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span>{getLanguageFromFileName(currentTab.name)}</span>
                    <span>UTF-8</span>
                    {currentTab.isDirty && (
                      <span className="text-orange-400">Unsaved</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="flex w-full max-w-6xl mx-auto">
                  {/* Left Side - Welcome */}
                  <div className="flex-1 flex flex-col items-center justify-center pr-8">
                    <div className="text-center mb-8">
                      <div className="mb-6">
                        <img src="/icon.png" alt="SoneT" className="w-24 h-24 mx-auto mb-4" />
                        <h1 className="text-4xl font-bold text-foreground mb-2">SoneT</h1>
                        <p className="text-lg text-muted-foreground">Modern Code Editor</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 max-w-md">
                        <button
                          onClick={createNewFile}
                          className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          New File
                        </button>
                        <button
                          onClick={openFile}
                          className="flex items-center gap-2 px-4 py-3 border border-border rounded hover:bg-accent transition-colors"
                        >
                          <File className="w-4 h-4" />
                          Open File
                        </button>
                      </div>
                      <div className="mt-4 max-w-md">
                        <button
                          onClick={openFolder}
                          className="flex items-center justify-center gap-2 px-4 py-3 border border-border rounded hover:bg-accent transition-colors w-full"
                        >
                          <Folder className="w-4 h-4" />
                          Open Folder
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Side - Recent Files */}
                  <div className="w-80 border-l border-border pl-8">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Recent Files</h3>
                    {recentFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent files</p>
                    ) : (
                      <div className="space-y-2">
                        {recentFiles.map((filePath, index) => {
                          const fileName = filePath.split('/').pop() || filePath
                          return (
                            <button
                              key={index}
                              onClick={() => openFileFromPath(filePath)}
                              className="w-full text-left p-3 rounded hover:bg-accent transition-colors group"
                            >
                              <div className="flex items-center gap-2">
                                <File className="w-4 h-4 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{filePath}</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu Dropdown */}
      <MenuDropdown
        isOpen={activeMenu !== null}
        onClose={() => setActiveMenu(null)}
        items={activeMenu ? menuItems[activeMenu as keyof typeof menuItems] : []}
        position={menuPosition}
      />

      {/* Launcher */}
      {showLauncher && (
        <Ulauncher
          isVisible={showLauncher}
          onClose={() => setShowLauncher(false)}
          onOpenFile={(fileName: string) => {
            const file = files.find(f => f.name === fileName)
            if (file && file.path) {
              openFileFromPath(file.path)
            }
          }}
          onCreateFile={() => {
            createNewFile()
            setShowLauncher(false)
          }}
          onOpenFileDialog={() => {
            openFile()
            setShowLauncher(false)
          }}
          onOpenFolderDialog={() => {
            openFolder()
            setShowLauncher(false)
          }}
          onListFiles={async (path: string) => {
            const fileList = await ListFiles(path)
            return fileList.map(file => ({
              name: file.name,
              type: file.isDir ? 'folder' as const : 'file' as const,
              path: file.path,
              size: file.size,
              modified: file.modified
            }))
          }}
        />
      )}

      {/* File Browser */}
      {showFileBrowser && (
        <FileBrowser
          isVisible={showFileBrowser}
          onClose={() => setShowFileBrowser(false)}
          onOpenFile={openFileFromPath}
          currentProject={currentProject}
          onListFiles={async (path: string) => {
            const fileList = await ListFiles(path)
            return fileList.map(file => ({
              name: file.name,
              type: file.isDir ? 'folder' as const : 'file' as const,
              path: file.path,
              size: file.size,
              modified: file.modified
            }))
          }}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div 
            className="absolute z-50 bg-popover border border-border rounded-lg shadow-xl py-2 min-w-48"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'editor' ? (
              <>
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { createNewFile(); setContextMenu(null) }}>New File</div>
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { openFolder(); setContextMenu(null) }}>Open Folder</div>
                <div className="border-t border-border mx-2 my-1" />
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { monacoRef.current?.trigger('keyboard', 'undo', null); setContextMenu(null) }}>Undo</div>
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { monacoRef.current?.trigger('keyboard', 'redo', null); setContextMenu(null) }}>Redo</div>
                <div className="border-t border-border mx-2 my-1" />
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { monacoRef.current?.trigger('keyboard', 'editor.action.clipboardCutAction', null); setContextMenu(null) }}>Cut</div>
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { monacoRef.current?.trigger('keyboard', 'editor.action.clipboardCopyAction', null); setContextMenu(null) }}>Copy</div>
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { monacoRef.current?.trigger('keyboard', 'editor.action.clipboardPasteAction', null); setContextMenu(null) }}>Paste</div>
                <div className="border-t border-border mx-2 my-1" />
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { monacoRef.current?.trigger('keyboard', 'editor.action.selectAll', null); setContextMenu(null) }}>Select All</div>
              </>
            ) : (
              <>
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { if(contextMenu.item?.type === 'file') openFileFromPath(contextMenu.item.path || ''); setContextMenu(null) }}>Open</div>
                <div className="border-t border-border mx-2 my-1" />
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { setRenamingItem(contextMenu.item?.path || ''); setInputValue(contextMenu.item?.name || ''); setContextMenu(null) }}>Rename</div>
                <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm text-red-400" onClick={() => { setContextMenu(null) }}>Delete</div>
                {contextMenu.item?.type === 'folder' && (
                  <>
                    <div className="border-t border-border mx-2 my-1" />
                    <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { setCreatingItem({ type: 'file', parentPath: contextMenu.item?.path || '' }); setInputValue(''); setContextMenu(null) }}>New File</div>
                    <div className="px-4 py-2 hover:bg-accent cursor-pointer text-sm" onClick={() => { setCreatingItem({ type: 'folder', parentPath: contextMenu.item?.path || '' }); setInputValue(''); setContextMenu(null) }}>New Folder</div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* KeyBindings Dialog */}
      <KeyBindings
        isVisible={showKeyBindings}
        onClose={() => setShowKeyBindings(false)}
      />

      {/* About Dialog */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-primary mb-2">SoneT</h1>
                <p className="text-muted-foreground">Modern Code Editor</p>
              </div>
              
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-foreground mb-2">A powerful, modern code editor built with cutting-edge technologies.</p>
                </div>
                
                <div className="border-t border-border pt-4">
                  <p className="text-muted-foreground mb-1">Developed by</p>
                  <p className="text-primary font-semibold">Bhavesh Solanki</p>
                </div>
                
                <div className="border-t border-border pt-4">
                  <p className="text-muted-foreground text-xs">Version 1.0.0</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowAbout(false)}
                className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}