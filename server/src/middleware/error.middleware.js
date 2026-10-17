const errorHandler = (err, req, res, next) => {
    console.error(err);

    const statusCode = err.statusCode || 500;

    if (
        Number.isFinite(err.retryAfterMs) &&
        err.retryAfterMs >= 0
    ) {
        res.setHeader(
            "Retry-After",
            Math.ceil(err.retryAfterMs / 1000).toString()
        );
    }

    res.status(statusCode).json({
        success: false,
        error: {
            code: err.code || "INTERNAL_SERVER_ERROR",
            message: err.message || "Something went wrong",
            ...(Number.isFinite(err.retryAfterMs)
                ? {
                      details: {
                          retryAfterMs:
                              err.retryAfterMs
                      }
                  }
                : {})
        }
    });
};

module.exports = errorHandler;
