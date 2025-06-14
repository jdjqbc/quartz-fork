import { ComponentChildren } from "preact"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import EncryptedContent from "../EncryptedContent"

const Content: QuartzComponent = ({ fileData, tree, cfg, ctx, externalResources, children, allFiles, displayClass }: QuartzComponentProps) => {
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  
  // Check if content should be encrypted
  const hasFrontmatterEncrypted = fileData.frontmatter?.encrypted === true
  const hasSOPSJson = fileData.text?.includes('"sops":') || false
  const hasSOPSYaml = fileData.text?.includes('sops:') || false
  const hasSOPSData = fileData.text?.includes('ENC[AES256_GCM') || false
  const isEncrypted = hasFrontmatterEncrypted || hasSOPSJson || hasSOPSYaml || hasSOPSData
  
  // Debug logging
  if (fileData.slug?.includes('encrypted') || fileData.slug?.includes('demo')) {
    console.log('🔍 Encryption Debug for:', fileData.slug)
    console.log('  - frontmatter.encrypted:', fileData.frontmatter?.encrypted)
    console.log('  - hasFrontmatterEncrypted:', hasFrontmatterEncrypted)
    console.log('  - hasSOPSJson:', hasSOPSJson)
    console.log('  - hasSOPSYaml:', hasSOPSYaml)
    console.log('  - hasSOPSData:', hasSOPSData)
    console.log('  - isEncrypted:', isEncrypted)
    console.log('  - text preview:', fileData.text?.substring(0, 100))
  }

  if (isEncrypted) {
    const EncryptedContentComponent = EncryptedContent()
    return (
      <article class={classString}>
        <EncryptedContentComponent 
          fileData={fileData} 
          cfg={cfg} 
          tree={tree}
          ctx={ctx}
          externalResources={externalResources}
          children={children}
          allFiles={allFiles}
          displayClass={displayClass}
        />
      </article>
    )
  }

  // Regular content rendering
  const content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
  return <article class={classString}>{content}</article>
}

export default (() => Content) satisfies QuartzComponentConstructor
