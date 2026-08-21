import {listSavedTopics,listTopics} from '../../../lib/db';
export const runtime='nodejs';
export async function GET(){return Response.json({items:listTopics(20),saved:listSavedTopics(50)})}
