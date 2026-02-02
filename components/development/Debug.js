import { useState, useEffect } from 'react'
import { useDebug } from '../../contexts/DebugContext'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

const JsonView = dynamic(() => import('react18-json-view').then(mod => mod.default), {
  ssr: false
})

export default function Debug() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('router')
  const router = useRouter()
  const { debugData } = useDebug()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  if (process.env.NODE_ENV !== 'development' || !isMounted) {
    return null
  }

  const tabs = {
    router: { label: 'Router', data: router },
    page: { label: 'Page Data', data: debugData },
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="fixed bottom-16 right-4 max-w-[95vw] w-[800px] h-[85vh] overflow-auto bg-gray-800 text-white rounded-lg shadow-xl">
          <div className="sticky top-0 flex flex-wrap border-b border-gray-700 bg-gray-800">
            {Object.entries(tabs).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 ${
                  activeTab === key ? 'bg-gray-700' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-6">
            <JsonView 
              src={tabs[activeTab].data} 
              dark={true}
              collapsed={2}
            />
          </div>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800 text-white px-4 py-2 rounded-md opacity-50 hover:opacity-100 transition-opacity duration-200"
      >
        🔍 Debug
      </button>
    </div>
  )
} 
