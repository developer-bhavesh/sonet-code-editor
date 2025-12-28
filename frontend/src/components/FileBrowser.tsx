import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, X, Folder, File } from 'lucide-react'

interface FileItem {
  name: string
  type: 'file' | 'folder'
  path?: string
  size?: number
  modified?: string
}

interface FileBrowserProps {
  isVisible: boolean
  onClose: () => void
  onOpenFile: (filePath: string) => void
  currentProject: string
  onListFiles: (path: string) => Promise<FileItem[]>
}

export function FileBrowser({ 
  isVisible, 
  onClose, 
  onOpenFile, 
  currentProject,
  onListFiles
}: FileBrowserProps) {

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentPath, setCurrentPath] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const indexedRef = useRef('')
  const lastProjectRef = useRef('')

  /* CACHE for directories */
  const cache = useRef<Map<string, FileItem[]>>(new Map())

  /* LOAD DIRECTORY */
  const loadFiles = async (path: string) => {
    setIsLoading(true)
    try {
      if(cache.current.has(path)){
        setFiles(cache.current.get(path)!)
      } else {
        const list = await onListFiles(path) // <— fixed always path
        cache.current.set(path,list)
        setFiles(list)
      }
    } catch {
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  /* NAVIGATION */
  const navigateTo = async (path:string)=>{
    setCurrentPath(path)
    await loadFiles(path)
    setSelectedIndex(0)
    setQuery('')
  }

  /* INDEX FOR SEARCH */
  const indexAllFiles = useCallback(async (root:string)=>{
    if(indexedRef.current === root) return
    setIsIndexing(true)
    setAllFiles([])

    const crawl=async(path:string,depth=0):Promise<FileItem[]>=>{
      if(depth>6) return []
      try {
        const list = await onListFiles(path)
        let collected:FileItem[]=[]
        
        for(const f of list){
          const filePath = f.path || (path.endsWith('/') ? `${path}${f.name}` : `${path}/${f.name}`)
          if(f.type==="file"){
            collected.push({...f,path:filePath})
          } else if(f.type==="folder" && !f.name.startsWith('.') && f.name!=="node_modules" && f.name!=="build" && f.name!=="dist"){
            const subFiles = await crawl(filePath,depth+1)
            collected = [...collected,...subFiles]
          }
        }
        return collected
      } catch {
        return []
      }
    }

    try {
      const result = await crawl(root)
      setAllFiles(result)
      indexedRef.current=root
    } catch {
      setAllFiles([])
    } finally {
      setIsIndexing(false)
    }
  },[onListFiles])

  /* FUZZY MATCH */
  const fuzzySearch = useCallback((q:string,items:FileItem[])=>{
    const term=q.toLowerCase()
    return items.map(f=>{
      const name=f.name.toLowerCase()
      const path=(f.path||'').toLowerCase()
      let s=0
      if(name===term) s+=900
      if(name.startsWith(term)) s+=500
      if(name.includes(term)) s+=250
      if(path.includes(term)) s+=120
      let i=0
      for(const c of name){
        if(c===term[i]){s+=15;i++}
        if(i===term.length)break
      }
      return s>0?{f,s}:null
    }).filter(Boolean)
      .sort((a,b)=>b!.s-a!.s)
      .slice(0,50)
      .map(r=>r!.f)
  },[])

  const filteredFiles = useMemo(()=>{
    if(!query.trim()) return files.slice(0,200)
    return allFiles.length?fuzzySearch(query,allFiles):
      files.filter(f=>f.name.toLowerCase().includes(query.toLowerCase()))
  },[query,files,allFiles,fuzzySearch])

  /* INIT */
  useEffect(()=>{
    if(isVisible && currentProject && lastProjectRef.current !== currentProject){
      cache.current.clear()
      setAllFiles([])
      indexedRef.current = ''
      lastProjectRef.current = currentProject
      navigateTo(currentProject)
      indexAllFiles(currentProject)
      setTimeout(()=>inputRef.current?.focus(),80)
    } else if(isVisible && currentProject === lastProjectRef.current){
      setTimeout(()=>inputRef.current?.focus(),80)
    }
  },[isVisible,currentProject,indexAllFiles])

  /* KEYBOARD */
  const handleKey=(e:React.KeyboardEvent)=>{
    if(e.key==="ArrowDown"){
      e.preventDefault()
      const newIndex = Math.min(selectedIndex + 1, filteredFiles.length - 1)
      setSelectedIndex(newIndex)
      scrollToItem(newIndex)
    }
    if(e.key==="ArrowUp"){
      e.preventDefault()
      const newIndex = Math.max(selectedIndex - 1, 0)
      setSelectedIndex(newIndex)
      scrollToItem(newIndex)
    }
    if(e.key==="Enter"){
      e.preventDefault()
      const f=filteredFiles[selectedIndex]
      if(f?.type==="folder")navigateTo(f.path!)
      else if(f) {onOpenFile(f.path!);onClose()}
    }
    if(e.key==="Escape"){e.preventDefault();onClose()}
  }

  const scrollToItem = (index: number) => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item]')
      const targetItem = items[index] as HTMLElement
      if (targetItem) {
        targetItem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }

  if(!isVisible) return null

  return(
<div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-32 z-50">
  <div className="bg-card border rounded-lg shadow-xl w-full max-w-3xl">

    {/* HEADER */}
    <div className="flex items-center gap-3 p-3 border-b">
      <Folder size={18}/>
      <div className="flex-1 font-medium truncate">{currentPath || currentProject}</div>
      <button onClick={onClose} className="hover:bg-accent rounded p-1"><X size={16}/></button>
    </div>

    {/* SEARCH */}
    <div className="flex items-center gap-2 p-3 border-b">
      <Search size={16} className="opacity-50"/>
      <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
        onKeyDown={handleKey} className="flex-1 bg-transparent outline-none"
        placeholder="Search files..."
      />
    </div>

    {/* LIST */}
    <div ref={listRef} className="max-h-80 overflow-y-auto scroll-smooth">
      {(isLoading||isIndexing)&&<div className="p-6 text-center text-sm opacity-60">{isIndexing?"Indexing files...":"Loading..."}</div>}

      {!isLoading && !isIndexing && filteredFiles.length === 0 && <div className="p-6 text-center text-sm opacity-60">No files found</div>}

      {filteredFiles.map((f,i)=>(
        <div key={f.path} data-item
          onClick={()=>f.type==="folder"?navigateTo(f.path!):(onOpenFile(f.path!),onClose())}
          className={`flex items-center gap-2 p-2 cursor-pointer text-sm ${
              i===selectedIndex?"bg-accent":"hover:bg-accent/50"
          }`}>
          {f.type==="file"?<File size={14}/>:<Folder size={14}/>}
          <div className="flex flex-col min-w-0">
            <div className="truncate">
              {query ? (
                <span dangerouslySetInnerHTML={{
                  __html: f.name.replace(new RegExp(query,"gi"),m=>`<mark class="bg-yellow-200 dark:bg-yellow-800">${m}</mark>`)
                }}/>
              ) : f.name}
            </div>
            {f.path && <div className="text-xs opacity-50 truncate">{f.path}</div>}
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
)}
