export class ApiError extends Error {
    constructor(HttpStatus, Code, Message) {
        super(Message);
        this.HttpStatus = HttpStatus;
        this.Code = Code;
    }
}

export function SendSuccess(Response, Data, HttpStatus = 200) {
    return Response.status(HttpStatus).json({ Success: true, Data });
}

export function NotFoundHandler(Request, Response) {
    Response.status(404).json({ Success: false, Error: { Code: 'NOT_FOUND', Message: 'Route not found.' } });
}

export function CreateErrorHandler(Logger) {
    // eslint-disable-next-line no-unused-vars
    return function ErrorHandler(RequestError, Request, Response, Next) {
        if (RequestError instanceof ApiError) {
            return Response.status(RequestError.HttpStatus).json({ Success: false, Error: { Code: RequestError.Code, Message: RequestError.message } });
        }
        // Errors raised by express.json() (bad JSON, body too large).
        if (RequestError?.type === 'entity.too.large') {
            return Response.status(413).json({ Success: false, Error: { Code: 'PAYLOAD_TOO_LARGE', Message: 'Request body is too large.' } });
        }
        if (RequestError?.type === 'entity.parse.failed') {
            return Response.status(400).json({ Success: false, Error: { Code: 'INVALID_JSON', Message: 'Request body is not valid JSON.' } });
        }

        Logger?.Error('Unhandled internal API error', { Method: Request.method, Path: Request.path, Error: RequestError });
        return Response.status(500).json({ Success: false, Error: { Code: 'INTERNAL_ERROR', Message: 'An internal error occurred.' } });
    };
}
