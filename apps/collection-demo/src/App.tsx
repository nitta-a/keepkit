import type { KeepItem } from "@keepkit/core/core";
import { KeepButton, KeepCollection, KeepEmptyState } from "@keepkit/ui";
import { useState } from "react";
import type { DemoMeta } from "./main";

type DemoItem = KeepItem<DemoMeta>;
type ViewMode = "minimal" | "advanced";

const resources: Array<DemoItem & { label: string }> = [
  {
    id: "resource-view-transitions",
    targetType: "article",
    label: "Article",
    savedAt: 0,
    updatedAt: 0,
    meta: {
      title: "View transitions for the web",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API",
      description: "A practical reference for adding motion between document states.",
      image: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80",
      collection: "reading",
    },
  },
  {
    id: "resource-design-systems",
    targetType: "article",
    label: "Article",
    savedAt: 0,
    updatedAt: 0,
    meta: {
      title: "Design systems that stay useful",
      url: "https://www.designsystems.com/",
      description: "Notes on keeping shared components close to real product work.",
      image: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=900&q=80",
      collection: "reading",
    },
  },
  {
    id: "resource-field-notes",
    targetType: "reference",
    label: "Reference",
    savedAt: 0,
    updatedAt: 0,
    meta: {
      title: "The field notes archive",
      url: "https://example.com/field-notes",
      description: "A small collection of prompts for observation and research.",
      image: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=80",
      collection: "research",
    },
  },
];

function toButtonItem(resource: DemoItem & { label: string }) {
  return {
    id: resource.id,
    targetType: resource.targetType ?? "resource",
    meta: resource.meta,
    tags: [resource.label, resource.meta.collection],
    collectionId: resource.meta.collection,
  };
}

function MinimalCollection() {
  return (
    <KeepCollection<DemoMeta>
      className="collection"
      layout="list"
      toolbarVariant="panel"
      pageSize={6}
      itemCardProps={{
        href: (item) => item.meta.url,
        title: (item) => item.meta.title,
        getImageProps: (item) => ({ src: item.meta.image, alt: "" }),
        collectionLabels: { reading: "Reading", research: "Research" },
      }}
      empty={<KeepEmptyState title="Nothing saved yet" description="Save one of the resources above to see it here." />}
    />
  );
}

function AdvancedCollection() {
  return (
    <KeepCollection<DemoMeta>
      className="collection"
      layout="auto"
      toolbarVariant="panel"
      toolbarLayout="grouped"
      archiveScope="all"
      reorderable
      pageSize={4}
      collectionLabels={{ reading: "Reading", research: "Research" }}
      features={{
        search: true,
        sort: true,
        tagFilter: true,
        collectionFilter: true,
        bulkActions: true,
        tags: true,
        pin: true,
        archive: true,
      }}
      itemCardProps={{
        href: (item) => item.meta.url,
        title: (item) => item.meta.title,
        getImageProps: (item) => ({ src: item.meta.image, alt: "" }),
        collectionLabels: { reading: "Reading", research: "Research" },
      }}
      empty={<KeepEmptyState title="No matching items" description="Try another filter or save a resource above." />}
    />
  );
}

export function App() {
  const [mode, setMode] = useState<ViewMode>("minimal");

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="kicker">KeepCollection lab</p>
        <h1>One collection, two levels of control.</h1>
        <p className="intro-copy">
          Start with the smallest useful collection, then turn on the controls your product actually needs.
        </p>
        <fieldset className="mode-switch">
          <legend>Collection example mode</legend>
          <button
            className={mode === "minimal" ? "mode-button active" : "mode-button"}
            type="button"
            aria-pressed={mode === "minimal"}
            onClick={() => setMode("minimal")}
          >
            Minimal
          </button>
          <button
            className={mode === "advanced" ? "mode-button active" : "mode-button"}
            type="button"
            aria-pressed={mode === "advanced"}
            onClick={() => setMode("advanced")}
          >
            Advanced
          </button>
        </fieldset>
      </header>

      <section className="resource-section" aria-labelledby="resources-heading">
        <div className="section-heading">
          <div>
            <p className="kicker">Try it</p>
            <h2 id="resources-heading">Save a resource</h2>
          </div>
          <span className="section-note">Stored locally in your browser</span>
        </div>
        <div className="resource-grid">
          {resources.map((resource) => (
            <article className="resource-card" key={resource.id}>
              <img src={resource.meta.image} alt="" />
              <div className="resource-card-body">
                <span className="resource-label">{resource.label}</span>
                <h3>{resource.meta.title}</h3>
                <p>{resource.meta.description}</p>
                <KeepButton
                  item={toButtonItem(resource)}
                  savedLabel="Saved"
                  unsavedLabel="Save resource"
                  savedAriaLabel="Saved resource"
                  unsavedAriaLabel="Save resource"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="collection-section" aria-labelledby="collection-heading">
        <div className="section-heading">
          <div>
            <p className="kicker">The component</p>
            <h2 id="collection-heading">Saved resources</h2>
          </div>
          <span className="mode-label">{mode === "minimal" ? "Minimal setup" : "Advanced setup"}</span>
        </div>
        {mode === "minimal" ? <MinimalCollection /> : <AdvancedCollection />}
      </section>
    </main>
  );
}
