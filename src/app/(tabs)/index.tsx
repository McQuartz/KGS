import type { ReactElement } from 'react';
import { useState } from 'react';
import { Screen, IconButton, Txt } from '../../components/ui';
import { BodyCard, ConsistencyCard, GoalCard, HintsSheet, LastWorkoutCard, StrengthCard, VolumeCard, WeightCard } from '../../components/dashboard';
import { useT } from '../../i18n';
import { useFormat } from '../../lib/format';
import { useQuery } from '../../lib/useQuery';
import { hints as computeHints } from '../../lib/insights';
import { useSettings } from '../../store/settings';

const CARDS: Record<string, () => ReactElement | null> = {
  last: LastWorkoutCard,
  weight: WeightCard,
  strength: StrengthCard,
  goal: GoalCard,
  body: BodyCard,
  volume: VolumeCard,
  consistency: ConsistencyCard,
};

export default function Home() {
  const tr = useT();
  const f = useFormat();
  const cards = useSettings((s) => s.dashboardCards);
  const hintsOn = useSettings((s) => s.hints);
  const seen = useSettings((s) => s.seenHintIds);
  const goalWeight = useSettings((s) => s.goalWeight);
  const [open, setOpen] = useState(false);
  const hints = useQuery(() => computeHints(), [hintsOn, goalWeight]);
  const unseen = hints.some((h) => !seen.includes(h.id));

  const openHints = () => {
    setOpen(true);
    const ids = hints.map((h) => h.id).filter((id) => !seen.includes(id));
    if (ids.length) useSettings.getState().set({ seenHintIds: [...seen, ...ids].slice(-300) });
  };

  const title = new Date().toLocaleDateString(f.locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const visible = cards.filter((c) => c.visible && CARDS[c.id]);

  return (
    <Screen
      eyebrow="KGS"
      title={title}
      right={hintsOn ? <IconButton name="bulb" size={21} boxed onPress={openHints} count={unseen ? hints.length : undefined} accessibilityLabel={tr('dash.hints')} /> : undefined}
    >
      {visible.map((c) => {
        const Card = CARDS[c.id];
        return <Card key={c.id} />;
      })}
      {visible.length === 0 ? <Txt v="muted">{tr('dash.empty')}</Txt> : null}
      <HintsSheet visible={open} onClose={() => setOpen(false)} hints={hints} />
    </Screen>
  );
}
