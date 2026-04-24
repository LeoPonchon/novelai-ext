import './Form.css';

function setField(onChange, value, key, next) {
  onChange({ ...value, [key]: next });
}

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function SettingsTab({ value, onChange }) {
  return (
    <div className="Form">
      <div className="Form-help">
        Utilise le <b>Persistent API Token</b> (NovelAI → Settings → Account → “Get Persistent API Token”).
        Le token est stocké dans le navigateur (localStorage) pour cette démo — évite de déployer ça tel quel
        en production.
      </div>

      <label className="Field">
        <div className="Field-label">Persistent API Token NovelAI</div>
        <input
          className="Input"
          type="password"
          value={value.token}
          onChange={(e) => setField(onChange, value, 'token', e.target.value)}
          placeholder="Colle le token (sans guillemets)"
          autoComplete="off"
        />
      </label>

      <div className="SectionTitle">Texte (OpenAI-compatible)</div>

      <label className="Field">
        <div className="Field-label">Base URL</div>
        <input
          className="Input"
          value={value.textBaseUrl}
          onChange={(e) => setField(onChange, value, 'textBaseUrl', e.target.value)}
          placeholder="https://text.novelai.net/oa/v1"
        />
      </label>

      <label className="Field">
        <div className="Field-label">Modèle</div>
        <input
          className="Input"
          list="textModels"
          value={value.textModel}
          onChange={(e) => setField(onChange, value, 'textModel', e.target.value)}
          placeholder="glm-4-6"
        />
        <datalist id="textModels">
          <option value="glm-4-6" />
          <option value="xialong-v1" />
        </datalist>
      </label>

      <label className="Field">
        <div className="Field-label">Température</div>
        <input
          className="Input"
          type="number"
          step="0.05"
          min="0"
          max="2"
          value={value.temperature}
          onChange={(e) => setField(onChange, value, 'temperature', toNum(e.target.value, 0.8))}
        />
      </label>

      <label className="Field">
        <div className="Field-label">Max tokens</div>
        <input
          className="Input"
          type="number"
          step="1"
          min="1"
          max="4000"
          value={value.maxTokens}
          onChange={(e) => setField(onChange, value, 'maxTokens', toNum(e.target.value, 400))}
        />
      </label>

      <div className="SectionTitle">Image</div>

      <label className="Field">
        <div className="Field-label">Base URL</div>
        <input
          className="Input"
          value={value.imageBaseUrl}
          onChange={(e) => setField(onChange, value, 'imageBaseUrl', e.target.value)}
          placeholder="https://image.novelai.net"
        />
      </label>

      <label className="Field">
        <div className="Field-label">Modèle</div>
        <input
          className="Input"
          list="imageModels"
          value={value.imageModel}
          onChange={(e) => setField(onChange, value, 'imageModel', e.target.value)}
          placeholder="nai-diffusion-4-5-curated"
        />
        <datalist id="imageModels">
          <option value="nai-diffusion-4-5-curated" />
          <option value="nai-diffusion-4-5-full" />
          <option value="nai-diffusion-4-full" />
          <option value="nai-diffusion-4-curated" />
          <option value="nai-diffusion-3" />
        </datalist>
      </label>

      <div className="Grid2">
        <label className="Field">
          <div className="Field-label">Largeur</div>
          <input
            className="Input"
            type="number"
            step="1"
            min="64"
            max="2048"
            value={value.width}
            onChange={(e) => setField(onChange, value, 'width', toNum(e.target.value, 832))}
          />
        </label>
        <label className="Field">
          <div className="Field-label">Hauteur</div>
          <input
            className="Input"
            type="number"
            step="1"
            min="64"
            max="2048"
            value={value.height}
            onChange={(e) => setField(onChange, value, 'height', toNum(e.target.value, 1216))}
          />
        </label>
      </div>

      <div className="Grid2">
        <label className="Field">
          <div className="Field-label">Steps</div>
          <input
            className="Input"
            type="number"
            step="1"
            min="1"
            max="80"
            value={value.steps}
            onChange={(e) => setField(onChange, value, 'steps', toNum(e.target.value, 28))}
          />
        </label>
        <label className="Field">
          <div className="Field-label">Scale</div>
          <input
            className="Input"
            type="number"
            step="0.1"
            min="0"
            max="20"
            value={value.scale}
            onChange={(e) => setField(onChange, value, 'scale', toNum(e.target.value, 5.5))}
          />
        </label>
      </div>

      <label className="Field">
        <div className="Field-label">Sampler</div>
        <input
          className="Input"
          value={value.sampler}
          onChange={(e) => setField(onChange, value, 'sampler', e.target.value)}
          placeholder="k_euler"
        />
      </label>

      <label className="CheckRow">
        <input
          type="checkbox"
          checked={Boolean(value.qualityToggle)}
          onChange={(e) => setField(onChange, value, 'qualityToggle', e.target.checked)}
        />
        <span>Quality tags</span>
      </label>

      <label className="CheckRow">
        <input
          type="checkbox"
          checked={Boolean(value.autoImage)}
          onChange={(e) => setField(onChange, value, 'autoImage', e.target.checked)}
        />
        <span>Générer une image à chaque réponse IA</span>
      </label>
    </div>
  );
}
