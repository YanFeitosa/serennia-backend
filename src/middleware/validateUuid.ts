import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validateUuidParam = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (id && !UUID_REGEX.test(id)) {
      res.status(400).json({ error: `Invalid ${paramName} format. Must be a valid UUID.` });
      return;
    }
    next();
  };
};

