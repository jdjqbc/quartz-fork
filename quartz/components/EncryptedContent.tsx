import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { JSX } from "preact"
import { useState, useEffect } from "preact/hooks"
import { ComponentChildren } from "preact"
import { htmlToJsx } from "../util/jsx"

const EncryptedContent: QuartzComponent = ({ fileData, cfg, tree }: QuartzComponentProps) => {
  const [decryptedContent, setDecryptedContent] = useState<string>("")
  const [isDecrypted, setIsDecrypted] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Check if content is encrypted (SOPS format or frontmatter flag)
  const isSOPSEncrypted = fileData.text?.includes('"sops":') || fileData.text?.includes('sops:') || false
  const isFrontmatterEncrypted = fileData.frontmatter?.encrypted === true

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return
    
    // Check for Azure AD-derived key first
    const azureAdKey = localStorage.getItem("azure-ad-encryption-key")
    if (azureAdKey && (isSOPSEncrypted || isFrontmatterEncrypted)) {
      console.log('🔑 Using Azure AD-derived encryption key')
      handleDecryptWithKey(azureAdKey)
      return
    }
    
    // Fallback to saved password for backward compatibility
    const savedPassword = localStorage.getItem("knowledge-base-key")
    if (savedPassword && (isSOPSEncrypted || isFrontmatterEncrypted)) {
      setPassword(savedPassword)
      handleDecrypt(savedPassword)
    }
  }, [isSOPSEncrypted, isFrontmatterEncrypted])

  const handleDecryptWithKey = async (keyBase64: string) => {
    setIsLoading(true)
    setError("")

    try {
      let decrypted: string
      
      if (isSOPSEncrypted) {
        // Handle SOPS encrypted content with master key
        decrypted = await clientSideDecryptWithMasterKey(fileData.text || "", keyBase64)
      } else if (isFrontmatterEncrypted) {
        // For frontmatter encryption, render content normally for authenticated users with master key
        decrypted = htmlToJsx(fileData.filePath!, tree) as string
      } else {
        throw new Error("Content is not encrypted")
      }
      
      setDecryptedContent(decrypted)
      setIsDecrypted(true)
      
    } catch (err) {
      console.error("Master key decryption failed, falling back to password:", err)
      // Don't set error - fall back to password prompt
      setIsLoading(false)
    } finally {
      if (isDecrypted) {
        setIsLoading(false)
      }
    }
  }

  const handleDecrypt = async (pwd: string = password) => {
    if (!pwd.trim()) {
      setError("Please enter a password")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      let decrypted: string
      
      if (isSOPSEncrypted) {
        // Handle SOPS encrypted content
        decrypted = await clientSideDecrypt(fileData.text || "", pwd)
      } else if (isFrontmatterEncrypted) {
        // Handle frontmatter encrypted content (demo password check)
        if (pwd === "demo-password") {
          // For demo, just render the content normally
          decrypted = htmlToJsx(fileData.filePath!, tree) as string
        } else {
          throw new Error("Invalid password")
        }
      } else {
        throw new Error("Content is not encrypted")
      }
      
      setDecryptedContent(decrypted)
      setIsDecrypted(true)
      
      // Save password to localStorage (consider security implications)
      if (typeof window !== "undefined") {
        localStorage.setItem("knowledge-base-key", pwd)
      }
      
    } catch (err) {
      setError("Failed to decrypt content. Check your password.")
      console.error("Decryption error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setIsDecrypted(false)
    setDecryptedContent("")
    setPassword("")
    if (typeof window !== "undefined") {
      localStorage.removeItem("knowledge-base-key")
      localStorage.removeItem("azure-ad-encryption-key")
    }
  }

  // Client-side AES decryption using Web Crypto API with master key from Key Vault
  const clientSideDecryptWithMasterKey = async (encryptedText: string, masterKey: string): Promise<string> => {
    try {
      // Extract encrypted content (everything after the SOPS header)
      const lines = encryptedText.split('\n')
      let encryptedDataStart = -1
      
      // Find where the actual encrypted content starts (after SOPS metadata)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('-----BEGIN ENCRYPTED CONTENT-----')) {
          encryptedDataStart = i + 1
          break
        }
        // Fallback: look for base64-like content after sops metadata
        if (lines[i].match(/^[A-Za-z0-9+/]+=*$/) && lines[i].length > 50) {
          encryptedDataStart = i
          break
        }
      }
      
      if (encryptedDataStart === -1) {
        throw new Error("Could not find encrypted content in file")
      }
      
      // Get the encrypted data (join lines until end marker or end of file)
      let encryptedDataEnd = lines.length
      for (let i = encryptedDataStart; i < lines.length; i++) {
        if (lines[i].startsWith('-----END ENCRYPTED CONTENT-----')) {
          encryptedDataEnd = i
          break
        }
      }
      
      const encryptedBase64 = lines.slice(encryptedDataStart, encryptedDataEnd).join('')
      
      // Decode base64
      const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
      
      // Extract IV (first 16 bytes) and ciphertext (rest)
      const iv = encryptedData.slice(0, 16)
      const ciphertext = encryptedData.slice(16)
      
      // Derive key from master key using PBKDF2 (same method as content encryption)
      const encoder = new TextEncoder()
      const masterKeyBuffer = encoder.encode(masterKey)
      const salt = encoder.encode("knowledge-base-salt") // Same salt as encryption
      
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        masterKeyBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
      )
      
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-CBC", length: 256 },
        false,
        ["decrypt"]
      )
      
      // Decrypt the content
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-CBC",
          iv: iv
        },
        derivedKey,
        ciphertext
      )
      
      // Convert back to text
      const decoder = new TextDecoder()
      return decoder.decode(decryptedBuffer)
      
    } catch (error) {
      console.error("Decryption with master key failed:", error)
      throw new Error("Failed to decrypt content with master key.")
    }
  }

  // Client-side AES decryption using Web Crypto API with raw key
  const clientSideDecryptWithKey = async (encryptedText: string, keyBase64: string): Promise<string> => {
    try {
      // Extract encrypted content (everything after the SOPS header)
      const lines = encryptedText.split('\n')
      let encryptedDataStart = -1
      
      // Find where the actual encrypted content starts (after SOPS metadata)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('-----BEGIN ENCRYPTED CONTENT-----')) {
          encryptedDataStart = i + 1
          break
        }
        // Fallback: look for base64-like content after sops metadata
        if (lines[i].match(/^[A-Za-z0-9+/]+=*$/) && lines[i].length > 50) {
          encryptedDataStart = i
          break
        }
      }
      
      if (encryptedDataStart === -1) {
        throw new Error("Could not find encrypted content in file")
      }
      
      // Get the encrypted data (join lines until end marker or end of file)
      let encryptedDataEnd = lines.length
      for (let i = encryptedDataStart; i < lines.length; i++) {
        if (lines[i].startsWith('-----END ENCRYPTED CONTENT-----')) {
          encryptedDataEnd = i
          break
        }
      }
      
      const encryptedBase64 = lines.slice(encryptedDataStart, encryptedDataEnd).join('')
      
      // Decode base64
      const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
      
      // Extract IV (first 16 bytes) and ciphertext (rest)
      const iv = encryptedData.slice(0, 16)
      const ciphertext = encryptedData.slice(16)
      
      // Import the raw key
      const keyBytes = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC', length: 256 },
        false,
        ['decrypt']
      )
      
      // Decrypt the content
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-CBC',
          iv: iv
        },
        cryptoKey,
        ciphertext
      )
      
      // Convert back to text
      const decoder = new TextDecoder()
      return decoder.decode(decryptedBuffer)
      
    } catch (error) {
      console.error("Decryption with Azure AD key failed:", error)
      throw new Error("Failed to decrypt content with Azure AD key.")
    }
  }

  // Client-side AES decryption using Web Crypto API
  const clientSideDecrypt = async (encryptedText: string, password: string): Promise<string> => {
    try {
      // Extract encrypted content (everything after the SOPS header)
      const lines = encryptedText.split('\n')
      let encryptedDataStart = -1
      
      // Find where the actual encrypted content starts (after SOPS metadata)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('-----BEGIN ENCRYPTED CONTENT-----')) {
          encryptedDataStart = i + 1
          break
        }
        // Fallback: look for base64-like content after sops metadata
        if (lines[i].match(/^[A-Za-z0-9+/]+=*$/) && lines[i].length > 50) {
          encryptedDataStart = i
          break
        }
      }
      
      if (encryptedDataStart === -1) {
        throw new Error("Could not find encrypted content in file")
      }
      
      // Get the encrypted data (join lines until end marker or end of file)
      let encryptedDataEnd = lines.length
      for (let i = encryptedDataStart; i < lines.length; i++) {
        if (lines[i].startsWith('-----END ENCRYPTED CONTENT-----')) {
          encryptedDataEnd = i
          break
        }
      }
      
      const encryptedBase64 = lines.slice(encryptedDataStart, encryptedDataEnd).join('')
      
      // Decode base64
      const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
      
      // Extract IV (first 16 bytes) and ciphertext (rest)
      const iv = encryptedData.slice(0, 16)
      const ciphertext = encryptedData.slice(16)
      
      // Derive key from password using PBKDF2
      const encoder = new TextEncoder()
      const passwordBuffer = encoder.encode(password)
      const salt = encoder.encode("knowledge-base-salt") // In production, use a random salt per file
      
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
      )
      
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-CBC", length: 256 },
        false,
        ["decrypt"]
      )
      
      // Decrypt the content
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-CBC",
          iv: iv
        },
        derivedKey,
        ciphertext
      )
      
      // Convert back to text
      const decoder = new TextDecoder()
      return decoder.decode(decryptedBuffer)
      
    } catch (error) {
      console.error("Decryption failed:", error)
      throw new Error("Failed to decrypt content. Please check your password.")
    }
  }

  if (!isSOPSEncrypted && !isFrontmatterEncrypted) {
    // Regular content, render normally (this shouldn't happen in this component)
    const content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
    return <div>{content}</div>
  }

  if (!isDecrypted) {
    // Show password prompt
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "400px",
        fontFamily: "Arial, sans-serif"
      }}>
        <div style={{
          background: "white",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          maxWidth: "400px",
          width: "100%"
        }}>
          <h3 style={{ marginBottom: "1rem", textAlign: "center" }}>🔐 Encrypted Content</h3>
          <p style={{ marginBottom: "1rem", color: "#666" }}>
            This content is encrypted. {typeof window !== "undefined" && localStorage.getItem("azure-ad-encryption-key") ? 
              "Azure AD automatic decryption failed. Enter password manually:" :
              "Please log in with Azure AD for automatic access, or enter password:"}
          </p>
          
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            onKeyPress={(e) => e.key === "Enter" && handleDecrypt()}
            placeholder="Enter decryption password"
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "1rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "1rem"
            }}
            disabled={isLoading}
          />
          
          {error && (
            <div style={{ color: "#e74c3c", marginBottom: "1rem", fontSize: "0.9rem" }}>
              {error}
            </div>
          )}
          
          <button
            onClick={() => handleDecrypt()}
            disabled={isLoading || !password.trim()}
            style={{
              width: "100%",
              padding: "0.5rem 1rem",
              background: isLoading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: isLoading ? "not-allowed" : "pointer"
            }}
          >
            {isLoading ? "Decrypting..." : "Decrypt Content"}
          </button>
        </div>
      </div>
    )
  }

  // Show decrypted content
  return (
    <div>
      <div style={{
        background: "#d4edda",
        border: "1px solid #c3e6cb",
        color: "#155724",
        padding: "0.5rem 1rem",
        borderRadius: "4px",
        marginBottom: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <span>🔓 Content decrypted {typeof window !== "undefined" && localStorage.getItem("azure-ad-encryption-key") ? "with Azure AD identity" : "with password"}</span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid #155724",
            color: "#155724",
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.8rem"
          }}
        >
          Lock
        </button>
      </div>
      
      <div>
        {isFrontmatterEncrypted ? (
          htmlToJsx(fileData.filePath!, tree) as ComponentChildren
        ) : (
          <div dangerouslySetInnerHTML={{ __html: decryptedContent }} />
        )}
      </div>
    </div>
  )
}

export default (() => EncryptedContent) satisfies QuartzComponentConstructor