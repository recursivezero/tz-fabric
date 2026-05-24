interface LimitSliderProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}

export const LimitSlider = ({ value, onChange, label = "Results" }: LimitSliderProps) => {
  return (
    <div className="limit-slider">
      <span className="limit-slider__label">{label}</span>
      <div className="limit-slider__track">
        <div
          className="limit-slider__fill"
          style={{ width: `${((value - 5) / 95) * 100}%` }}
        />
        <input
          type="range"
          className="limit-slider__input"
          min={5} max={100} step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <span className="limit-slider__value">{value}</span>
    </div>
  );
};