import { CHARACTER_IDS, CHARACTERS, type CharacterId } from "../entities/characters";
import styles from "./CharacterPicker.module.css";

export function CharacterPicker({ value, onChange, disabled = false }: {
  value: CharacterId;
  onChange: (id: CharacterId) => void;
  disabled?: boolean;
}) {
  return <fieldset className={styles.picker} disabled={disabled}>
    <legend>選擇車手</legend>
    <div className={styles.options}>
      {CHARACTER_IDS.map(id => <button key={id} type="button" aria-pressed={value === id}
        aria-label={`選擇${CHARACTERS[id].name}`} onClick={() => onChange(id)}
        style={{ borderColor: value === id ? CHARACTERS[id].accent : undefined }}>
        <span className={styles.portrait} role="img" aria-label={CHARACTERS[id].description}
          style={{ backgroundImage: `url(/characters/${id}.png)` }} />
        <strong>{CHARACTERS[id].name}</strong>
      </button>)}
    </div>
    <p>{CHARACTERS[value].description} · 所有車手性能相同</p>
  </fieldset>;
}
