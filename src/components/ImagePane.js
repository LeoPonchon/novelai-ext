import './ImagePane.css';

export function ImagePane({ url, loading, error, meta }) {
  return (
    <div className="ImagePane">
      <div className="ImagePane-header">
        <div className="ImagePane-title">Scène</div>
        <div className="ImagePane-meta">
          {meta?.model ? <span className="Mono">{meta.model}</span> : null}
          {meta?.seed ? <span className="Mono">seed:{meta.seed}</span> : null}
          {meta?.file ? <span className="Mono">{meta.file}</span> : null}
        </div>
      </div>

      <div className="ImagePane-body">
        {loading ? <div className="ImagePane-overlay">Génération…</div> : null}
        {error ? <div className="ImagePane-error">{error}</div> : null}
        {url ? <img className="ImagePane-img" src={url} alt="Scene" /> : <div className="ImagePane-empty" />}
      </div>

      {meta?.prompt ? (
        <div className="ImagePane-prompt">
          <div className="ImagePane-promptTitle">Prompt</div>
          <div className="ImagePane-promptText">{meta.prompt}</div>
        </div>
      ) : null}
    </div>
  );
}
