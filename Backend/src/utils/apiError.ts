class ApiError extends Error {
    statusCode: number;
    data: null;
    success: boolean;
    errors: any[];

    constructor(
        statusCode: number,
        message: string = "Error",
        errors: any[] = []
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.success = false;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}

export { ApiError };