import React from 'react';

export type AutocompleteItemType = 'member' | 'channel' | 'emoji';

export interface AutocompleteItem {
  id: string;
  label: string;
  sublabel?: string;
  avatar?: string;
  prefix?: string;
}

interface Props {
  type: AutocompleteItemType;
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  onDismiss: () => void;
  style?: React.CSSProperties;
}

export function MentionAutocomplete({ type, items, selectedIndex, onSelect, onDismiss, style }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="mention-autocomplete" style={style}>
      {items.slice(0, 8).map((item, i) => (
        <div
          key={item.id}
          className={`mention-autocomplete-item ${i === selectedIndex ? 'selected' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
        >
          {item.avatar && <img src={item.avatar} className="mention-avatar" alt="" />}
          {!item.avatar && <span className="mention-prefix">{type === 'channel' ? '#' : type === 'emoji' ? ':' : '@'}</span>}
          <span className="mention-label">{item.label}</span>
          {item.sublabel && <span className="mention-sublabel">{item.sublabel}</span>}
        </div>
      ))}
    </div>
  );
}
