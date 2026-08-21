interface IconProps {
  name: string;
  className?: string;
}

export function Icon({ name, className = "momentum-icon" }: IconProps) {
  return <span className={`${className} icon ${name}`} aria-hidden="true" />;
}
