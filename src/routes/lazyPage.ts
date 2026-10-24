import { createElement, lazy, Suspense } from 'react';
import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { LoadBoundary, PageLoading } from './LoadStates';

// Every screen is downloaded the first time it is opened, not with the first page, so a patient's phone does not
// download the doctor's and the care team's screens.

// A page may take any props, so the helpers below have to accept any component; each page keeps its own props type.
// oxlint-disable-next-line typescript/no-explicit-any
type AnyComponent = ComponentType<any>;

/** Turns `import('./Page')` into the `{ default }` shape that lazy loading needs, for a page exported by name. */
export const named =
  <K extends string>(key: K) =>
  <M extends Record<K, AnyComponent>>(module: M) => ({ default: module[key] });

export function lazyPage<C extends AnyComponent>(load: () => Promise<{ default: C }>, fallback?: ReactNode) {
  const Page = lazy(load) as unknown as ComponentType<Record<string, unknown>>;
  return (props: ComponentProps<C>) =>
    createElement(
      LoadBoundary,
      null,
      createElement(Suspense, { fallback: fallback ?? createElement(PageLoading) }, createElement(Page, props as Record<string, unknown>)),
    );
}
