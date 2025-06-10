import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { JSX } from "preact"
import { useState, useEffect } from "preact/hooks"

interface EncryptedContentProps {
  encryptedData: string
  filename: string
}

const EncryptedContent: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  const [decryptedContent, setDecryptedContent] = useState<string>("")
  const [isDecrypted, setIsDecrypted] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Check if content is encrypted (contains SOPS metadata)
  const isEncrypted = fileData.text?.includes("sops:") || false

  useEffect(() => {
    // Try to get saved password from localStorage
    const savedPassword = localStorage.getItem("knowledge-base-key")
    if (savedPassword && isEncrypted) {
      setPassword(savedPassword)
      handleDecrypt(savedPassword)
    }
  }, [isEncrypted])

  const handleDecrypt = async (pwd: string = password) => {
    if (!pwd.trim()) {
      setError("Please enter a password")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // This is a simplified client-side decryption
      // In practice, you'd implement proper AES decryption here
      // For now, we'll use a simple XOR cipher as a placeholder
      
      const decrypted = await clientSideDecrypt(fileData.text || "", pwd)
      setDecryptedContent(decrypted)
      setIsDecrypted(true)
      
      // Save password to localStorage (consider security implications)
      localStorage.setItem("knowledge-base-key", pwd)
      
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
    localStorage.removeItem("knowledge-base-key")
  }

  // Simple client-side decryption (placeholder - replace with proper crypto)
  const clientSideDecrypt = async (encryptedText: string, key: string): Promise<string> => {
    // This is a PLACEHOLDER implementation
    // Replace with proper AES decryption using Web Crypto API
    
    // For demo purposes, let's just return the original content if password matches
    // In reality, you'd implement proper SOPS-compatible decryption
    if (key === "demo-password") {
      return encryptedText.replace(/sops:.*?---\n/s, "")
    }
    
    throw new Error("Invalid password")
  }

  if (!isEncrypted) {
    // Regular content, render normally
    return <div dangerouslySetInnerHTML={{ __html: fileData.text || "" }} />
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
            This content is encrypted. Enter your password to decrypt it.
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
        <span>🔓 Content decrypted successfully</span>
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
      
      <div dangerouslySetInnerHTML={{ __html: decryptedContent }} />
    </div>
  )
}

export default (() => EncryptedContent) satisfies QuartzComponentConstructor