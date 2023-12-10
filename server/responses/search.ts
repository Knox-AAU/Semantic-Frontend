import { IncomingMessage as Request, ServerResponse as Response } from 'http';
import { determineMimeType, getPostData } from '../serverHelpers';
import { errorResponse } from '../responseHandlers';
import { llamaUrl } from '../../app';
import { Llama_Analyze } from './LlamaAnalyzer';
import { fetch_TripleFromGraph } from './knowledgeGraphFetcher';
type queryRequest = {
	query: string;
	publishedAfter: string;
	publishedBefore: string;
};
const targetContainerHostname = 'ranking'; //  container name

export const url = `http://${targetContainerHostname}:6969/`; //  portNumber and path

export function KNOXSearch(req: Request, res: Response) {
	// Extract data from the request body
	getPostData(req) //Returns promise that retrieves post data in chunks
		.then(async (data: any) => {
			console.log('Data: ' + JSON.stringify(data));

			//Format the data as per the Llama API request structure
			const formattedData = data as queryRequest;
			console.log('2');
			// Llama_Analyze returns an array:[subject, object, predicate]
			const llamaresult: string[] | null = await Llama_Analyze(
				res,
				formattedData.query
			);
			if (!llamaresult) return;
			console.log('3');
			const subjectWord: string = llamaresult[0];
			console.log('4');
			const objectWord: string = llamaresult[1];
			console.log('5');
			const predicateWord: string = llamaresult[2];
			console.log('6');
			const nodeArray: string[] | null = await fetch_TripleFromGraph(
				res,
				subjectWord,
				objectWord,
				predicateWord
			);
			if (!nodeArray) return;
			console.log('7');
			//use nodeArray to get files from the Ranking module:
			console.log('nodeArray' + nodeArray);
			bertSearch(req, res, { query: nodeArray.join(' ') });
		});
}

export function bertSearchDecorator(req: Request, res: Response) {
	getPostData(req)
		.then((data: any) => {
			bertSearch(req, res, data);
		})
		.catch((err) => {
			errorResponse(
				res,
				503,
				`searcherror 4: Could not extract data from the request body. ${err.toString()}`
			);
		});
}

export function bertSearch(req: Request, res: Response, data: any) {
	fetch(url + 'query', {
		method: 'POST',
		body: JSON.stringify(data),
	})
		.then(async (response) => {
			if (response.ok) {
				response
					.json()
					.then((data: any) => {
						res.statusCode = 200;
						res.setHeader('Content-Type', determineMimeType('.json'));
						res.write(JSON.stringify(data));
						res.end('\n');
					})
					.catch((err) => {
						errorResponse(
							res,
							500,
							`searcherror 1: Failed to parse response data. ${err.toString()}`
						);
					});
			} else {
				console.log('Err');
				errorResponse(
					res,
					response.status,
					`searcherror 2: Ranker-script returned an error status (${response.status}).`
				);
			}
		})
		.catch((err) => {
			errorResponse(
				res,
				500,
				`searcherror 3: couldnt connect to python container, is it running?. ${err.toString()}`
			);
		});
}
