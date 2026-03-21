/**
 * Bridge @types/react v18 ↔ v19 compatibility.
 *
 * Some transitive deps (lucide-react, pretty-format) pull in @types/react@19
 * which adds `bigint` to `ReactNode`. Our project pins @types/react@18 which
 * lacks it, causing TS2786 ("cannot be used as a JSX component") for every
 * lucide icon and similar ForwardRef components.
 *
 * Adding `bigint` to the React namespace makes the two versions compatible.
 */
import 'react';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DO_NOT_USE_OR_YOU_WILL_BE_FIRED_EXPERIMENTAL_REACT_NODES {
    bigint: bigint;
  }
}
