import { aidaQuestions } from "../../../data";
import {
  queryForQuestion,
  retrieveOpenAccessCorpus,
} from "../../../lib/openAccessCorpus";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    query?: string;
    questionId?: string;
  } | null;
  const question =
    aidaQuestions.find((candidate) => candidate.id === payload?.questionId) ??
    aidaQuestions[0];
  const query = payload?.query?.trim() || queryForQuestion(question);

  return Response.json(
    await retrieveOpenAccessCorpus(query, { maxResults: 4 }),
  );
}
