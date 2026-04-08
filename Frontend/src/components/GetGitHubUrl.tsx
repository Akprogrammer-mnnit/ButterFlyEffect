import { useState } from "react"
import axios from "axios"

interface ApiResponse {
    data: {
        message: string;
    }
}
function GetGitHubUrl() {
    const [url, setUrl] = useState<string>("")
    const [loading, setLoading] = useState<boolean>(false)
    const [message, setMessage] = useState<string>("")
    const [error, setError] = useState<string>("")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setMessage("")
        setError("")
        try {
            const response: ApiResponse = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/clone`,
                { gitHubURL: url }
            )
            if (response?.data) {
                setMessage(response.data.message)
            }
        } catch {
            setError("Failed to Upload")
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="animate-pulse text-lg tracking-wide">Cloning repository…</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 to-black px-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md bg-gray-900/80 backdrop-blur rounded-2xl shadow-xl p-6 space-y-4 border border-gray-800"
            >
                <h1 className="text-2xl font-semibold text-white text-center">
                    GitHub Repository Import
                </h1>

                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://github.com/username/repo"
                    className="w-full px-4 py-3 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />

                <button
                    type="submit"
                    className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition font-medium text-white disabled:opacity-60"
                    disabled={!url}
                >
                    Submit
                </button>

                {message && (
                    <p className="text-green-400 text-sm text-center">
                        {message}
                    </p>
                )}

                {error && (
                    <p className="text-red-400 text-sm text-center">
                        {error}
                    </p>
                )}
            </form>
        </div>
    )
}

export default GetGitHubUrl
