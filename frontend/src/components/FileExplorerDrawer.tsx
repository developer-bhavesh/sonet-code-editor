import { useState, useEffect } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  FileText,
  Image,
  Code,
  Settings,
  Database,
  RefreshCw
} from 'lucide-react'

interface FileItem {
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileItem[]
  isOpen?: boolean
  size?: number
  modified?: string
}

interface FileExplorerDrawerProps {
  isOpen: boolean
  onClose: () => void
  files: FileItem[]
  onFileSelect: (filePath: string) => void
  onRefresh: () => void
  currentProject: string
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'py':
    case 'go':
    case 'java':
    case 'cpp':
    case 'c':
    case 'rs':
      return <Code className="w-4 h-4 text-blue-400" />
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
      return <Settings className="w-4 h-4 text-orange-400" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <Image className="w-4 h-4 text-green-400" />
    case 'sql':
    case 'db':
      return <Database className="w-4 h-4 text-purple-400" />
    case 'md':
    case 'txt':
      return <FileText className="w-4 h-4 text-gray-400" />
    default:
      return <File className="w-4 h-4 text-gray-400" />
  }
}

interface FileTreeItemProps {
  item: FileItem
  level: number
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}

function FileTreeItem({ item, level, onToggle, onSelect }: FileTreeItemProps) {
  const handleClick = () => {
    if (item.type === 'folder') {
      onToggle(item.path)
    } else {
      onSelect(item.path)
    }
  }

  return (
    <div>
      <div
        className={`
          flex items-center py-1 px-2 hover:bg-accent/50 cursor-pointer
          transition-colors duration-150 group text-sm
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {item.type === 'folder' && (
          <div className="w-4 h-4 mr-1 flex items-center justify-center">
            {item.isOpen ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        )}
        
        <div className="w-4 h-4 mr-2 flex items-center justify-center">
          {item.type === 'folder' ? (
            item.isOpen ? (
              <FolderOpen className="w-4 h-4 text-blue-400" />
            ) : (
              <Folder className="w-4 h-4 text-blue-400" />
            )
          ) : (
            getFileIcon(item.name)
          )}
        </div>
        
        <span className="text-foreground truncate flex-1">
          {item.name}
        </span>
      </div>
      
      {item.type === 'folder' && item.isOpen && item.children && (
        <div className="animate-in slide-in-from-top-1 duration-150">
          {item.children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={child}
              level={level + 1}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileExplorerDrawer({ 
  isOpen, 
  onClose, 
  files, 
  onFileSelect, 
  onRefresh,
  currentProject 
}: FileExplorerDrawerProps) {
  const [fileTree, setFileTree] = useState<FileItem[]>(files)

  useEffect(() => {
    setFileTree(files)
  }, [files])

  const toggleFolder = (path: string) => {
    const updateTree = (items: FileItem[]): FileItem[] => {
      return items.map(item => {
        if (item.path === path && item.type === 'folder') {
          return { ...item, isOpen: !item.isOpen }
        }
        if (item.children) {
          return { ...item, children: updateTree(item.children) }
        }
        return item
      })
    }
    setFileTree(updateTree(fileTree))
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar Drawer */}
      <div className={`
        fixed left-0 top-0 h-full w-80 bg-background border-r border-border
        shadow-2xl z-50 transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Explorer</h2>
            {currentProject && (
              <p className="text-xs text-muted-foreground truncate mt-0.5" title={currentProject}>
                {currentProject.split('/').pop()}
              </p>
            )}
          </div>
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {/* File Tree */}
        <div className="flex-1 overflow-y-auto">
          {fileTree.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium mb-1">No folder open</p>
              <p className="text-xs">Open a folder to browse files</p>
            </div>
          ) : (
            <div className="py-2">
              {fileTree.map((item) => (
                <FileTreeItem
                  key={item.path}
                  item={item}
                  level={0}
                  onToggle={toggleFolder}
                  onSelect={onFileSelect}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Close Button - Arrow style on the right edge */}
        <button
          onClick={onClose}
          className={`
            absolute -right-6 top-1/2 -translate-y-1/2
            w-6 h-12 bg-background border border-l-0 border-border
            rounded-r-lg shadow-lg hover:bg-accent
            flex items-center justify-center
            transition-all duration-200 group
          `}
          title="Close Explorer"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>
    </>
  )
}