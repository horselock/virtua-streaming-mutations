import type { ViewportComponentAttributes } from "./types.js";
import type {
  VirtualizerHandle,
  VirtualizerProps,
} from "./Virtualizer.type.js";

/**
 * Props of {@link VList}.
 */
export interface VListProps<T>
  extends
    Pick<
      VirtualizerProps<T>,
      | "data"
      | "getKey"
      | "getContentVersion"
      | "contentTrigger"
      | "bufferSize"
      | "itemSize"
      | "ssrCount"
      | "shift"
      | "followEnd"
      | "followEndThreshold"
      | "horizontal"
      | "children"
      | "onscroll"
      | "onscrollend"
      | "onresize"
      | "keepMounted"
      | "cache"
      | "itemProps"
    >,
    ViewportComponentAttributes {}

/**
 * Methods of {@link VList}.
 */
export interface VListHandle extends VirtualizerHandle {}
