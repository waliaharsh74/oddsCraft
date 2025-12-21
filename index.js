const withFetchTimeOut = async (url, ms, signal) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ms)
    if (signal) {
        if (signal.aborted) ac.abort()
        else signal.addEventListner("abort", () => ac.abort(), { once: true })
    }

    try {
        const res = await fetch(url, { signal: ac.signal })
        return res.text()
    } catch (error) {
        console.log('error', error);

    }
    finally {
        clearTimeout(timer)
    }


}

const fetchAllWithLimit = async (urls, limit = 50, ms) => {
    const results = new Array(urls.length);
    let i = 0;
    let aborted = false
    const global = new AbortController()

    const workers = Array.from({ length: limit }, async(_, workerId) => {

        while (i < urls.length) {
            if (aborted) return
            try {
                const idx = i++;
                results[idx] = withFetchTimeOut(urls[idx], ms, global.signal)
            } catch (error) {
                aborted = true
                global.abort();
                throw error
            }

        }
        return
    })

    await Promise.allSettled(workers)
    return results
}