"use client";

import { useState } from "react";
import {
  CATEGORIES,
  FLOWERS,
  SCENE,
  VASES,
  type CategoryId,
} from "@/lib/bouquet/catalog";
import { Icon } from "./Icons";

type Props = {
  count: number;
  activeTab: CategoryId;
  onTab: (tab: CategoryId) => void;
  vaseId: string;
  onPickVase: (id: string) => void;
  onPlaceFlower: (id: string) => boolean; // false when the vase is full
  onRandom: () => void;
  onReset: () => void;
  resetOpen: boolean;
};

export default function InventoryPanel({
  count,
  activeTab,
  onTab,
  vaseId,
  onPickVase,
  onPlaceFlower,
  onRandom,
  onReset,
  resetOpen,
}: Props) {
  const [shaking, setShaking] = useState<string | null>(null);

  function place(id: string) {
    if (onPlaceFlower(id)) return;
    setShaking(null);
    requestAnimationFrame(() => setShaking(id));
    window.setTimeout(() => setShaking(null), 360);
  }

  return (
    <section id="inventory">
      {/* Standalone instruction, deliberately above the tabs: sitting next to
          the randomize/reset pills it read as a caption for them. */}
      <p className="panel-blurb">
        Curate your own flower bouquet with Michigan native wildflowers!
      </p>

      <div className="tabrow">
        <div className="tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`tab${cat === activeTab ? " active" : ""}`}
              onClick={() => onTab(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Sits with the catalog because that is where stems get added, and
            fills the space the removed filter button left. Inverts at the cap
            so the shake on a 6th click has a visible reason. */}
        <span
          className={`stem-count${count >= SCENE.maxStems ? " full" : ""}`}
          aria-label={`${count} of ${SCENE.maxStems} flowers placed`}
        >
          {count}/{SCENE.maxStems}
        </span>
      </div>

      <div className="grid-scroll">
        <div className="grid">
          {activeTab === "vases"
            ? VASES.map((v) => (
                <button
                  key={v.id}
                  className={`card vase-card${v.id === vaseId ? " active" : ""}`}
                  style={{ background: `var(--${v.cardColor})` }}
                  onClick={() => onPickVase(v.id)}
                >
                  <span className="cardname">{v.name}</span>
                  {/* plain <img>: these are pre-cropped, fixed-size, and the
                      canvas export reads the same bitmaps from a manual cache */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.asset} alt={v.name} draggable={false} />
                </button>
              ))
            : FLOWERS.map((f) => (
                <button
                  key={f.id}
                  className={`card${shaking === f.id ? " shake" : ""}`}
                  style={{ background: `var(--${f.cardColor})` }}
                  onClick={() => place(f.id)}
                >
                  <span className="cardname">{f.name}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.asset} alt={f.name} draggable={false} />
                </button>
              ))}
        </div>
      </div>

      {/* Whole-bouquet actions live with the catalog, not the rail: the rail is
          56px wide and a labelled pill needs roughly twice that. */}
      <div className="panel-actions">
        <button className="action-pill" onClick={onRandom}>
          <span className="ap-icon">
            <Icon name="random" size={16} />
          </span>
          randomize
        </button>
        <button
          className={`action-pill${resetOpen ? " open" : ""}`}
          onClick={onReset}
        >
          <span className="ap-icon">
            <Icon name="reset" size={16} />
          </span>
          reset
        </button>
      </div>
    </section>
  );
}
