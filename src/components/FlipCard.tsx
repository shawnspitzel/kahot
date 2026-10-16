import type { Card, Side } from '../../shared/types';
import { otherSide, sideLabel } from '../lib/study';
import { AudioButton, CardText, StarButton } from './common';

/** A card that flips between its two sides. Give it `key={card.id}` so a new card never animates in mid-flip. */
export function FlipCard(props: {
  card: Card;
  front: Side;
  flipped: boolean;
  onFlip: () => void;
  onCardChange?: (card: Card) => void;
  size?: 'large' | 'small';
}) {
  const { card, front, flipped, onFlip, onCardChange, size = 'large' } = props;

  const face = (side: Side, className: string) => (
    <div className={`flip-face ${className}`}>
      <div className="face-tools">
        <span className="face-label">{sideLabel(side)}</span>
        <span>
          <AudioButton text={card[side]} />
          {onCardChange && <StarButton card={card} onChange={onCardChange} />}
        </span>
      </div>
      <CardText card={card} side={side} />
    </div>
  );

  return (
    <div
      className={`flip-card ${size} ${flipped ? 'flipped' : ''}`}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label="Flip card"
    >
      <div className="flip-inner">
        {face(front, 'flip-front')}
        {face(otherSide(front), 'flip-back')}
      </div>
    </div>
  );
}
