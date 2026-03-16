import { useState, useCallback } from 'react'

export default function UploadZone({ onFileSelect, file }) {
  const [drag, setDrag] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      onFileSelect(droppedFile)
    }
  }, [onFileSelect])

  const handleChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) onFileSelect(selectedFile)
  }

  const zoneClass = `upload-zone ${drag ? 'drag-active' : ''} ${file ? 'has-file' : ''}`

  return (
    <div
      className={zoneClass}
      onDragEnter={() => setDrag(true)}
      onDragLeave={() => setDrag(false)}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={handleChange}
      />
      <div className="upload-icon">
        {file ? '📄' : '☁️'}
      </div>
      {file ? (
        <>
          <h3>Fichier prêt à l'analyse</h3>
          <p>Cliquez sur "Analyser mon RIS" pour démarrer</p>
          <div className="upload-filename">
            ✓ {file.name}
          </div>
        </>
      ) : (
        <>
          <h3>Déposez votre RIS ici</h3>
          <p>ou cliquez pour parcourir vos fichiers</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-success">✓ PDF natif</span>
            <span className="badge badge-success">✓ PDF scanné (OCR)</span>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-subtle)' }}>
            Vos données sont traitées de façon sécurisée et confidentielle
          </p>
        </>
      )}
    </div>
  )
}
