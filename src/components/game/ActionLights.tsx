interface ActionLightsProps {
  owner: string;
  remaining: number;
  total: number;
}

export default function ActionLights({ owner, remaining, total }: ActionLightsProps) {
  return (
    <span className="wd-action-lights" data-motion-anchor={`actions:${owner}`}>
      <span className="sr-only">{remaining} / {total} actions left</span>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} data-action-light="" aria-hidden="true" className={index < remaining ? 'is-available' : undefined} />
      ))}
    </span>
  );
}
