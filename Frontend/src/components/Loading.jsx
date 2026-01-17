function Loading() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
            <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 rounded-full border-4 border-gray-300/30 border-t-white animate-spin" />
                <p className="text-sm text-gray-200 tracking-wide">
                    Loading…
                </p>
            </div>
        </div>
    )
}

export default Loading
