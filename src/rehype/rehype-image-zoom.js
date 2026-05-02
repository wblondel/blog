import { visit } from "unist-util-visit";

export default function rehypeImageZoom() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "img") {
        // Skip zooming if the image is wrapped in a link
        if (parent && parent.tagName === "a") {
          return;
        }

        node.properties = node.properties || {};

        // Skip autoscrolling images — they live inside a fixed viewport with their own animation
        const existingClass = String(node.properties.class || "");
        if (existingClass.split(/\s+/).includes("autoscroll-img")) {
          return;
        }

        // Skip zooming for SVGs as they can be very wide and often need to be viewed natively
        const src = node.properties?.src || "";
        if (String(src).endsWith(".svg")) {
          node.properties.class = existingClass + " clickable-svg cursor-pointer";
          return;
        }

        node.properties.class = existingClass + " zoomable-img";
      }
    });
  };
}