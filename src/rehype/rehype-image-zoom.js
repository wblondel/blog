import { visit } from "unist-util-visit";

export default function rehypeImageZoom() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "img") {
        // Skip zooming if the image is wrapped in a link
        if (parent && parent.tagName === "a") {
          return;
        }

        // Skip zooming for SVGs as they can be very wide and often need to be viewed natively
        const src = node.properties?.src || "";
        node.properties = node.properties || {};
        if (String(src).endsWith(".svg")) {
          node.properties.class = (node.properties.class || "") + " clickable-svg cursor-pointer";
          return;
        }

        node.properties.class = (node.properties.class || "") + " zoomable-img";
      }
    });
  };
}