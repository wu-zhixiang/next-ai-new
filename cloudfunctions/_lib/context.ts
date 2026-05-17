import { app } from '../shared/db';

export function getWxContext() {
  return app.getWXContext();
}
