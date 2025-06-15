import { ComponentChildren } from "preact"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

const Content: QuartzComponent = ({ fileData, tree, cfg, ctx, externalResources, children, allFiles, displayClass }: QuartzComponentProps) => {
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  
  // Render all content normally (no encryption handling)
  const content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
  return <article class={classString}>{content}</article>
}

export default (() => Content) satisfies QuartzComponentConstructor
