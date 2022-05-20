import { createDataBox, DataBoxProps, Cancellable, DataBoxHook, DataBoxComponent } from '..';

export type RequestSerializer<RQ> = (req: RQ | undefined) => string;
export type ResponseDeserializer<V> = (res: unknown) => V | undefined;

export type HttpRequestParams<RQ, V> = {
  method?: 'get' | 'post';
  headers?: { [key: string]: string };
  serializer: RequestSerializer<RQ | undefined>;
  deserializer: ResponseDeserializer<V>;
};

const defaults = {
  method: 'get',
  headers: {
    'Content-Type': 'application/json',
  },
  serializer: (rq: unknown): string => (rq ? `q=${JSON.stringify(rq)}` : ''),
  deserializer: (res: Body) => res.json(),
};

function fetchRequest<RQ, V>(
  url: string,
  rq: RQ | undefined,
  params: HttpRequestParams<RQ, V> | undefined,
  setPending: (p: boolean) => void,
  setValue: (v: V) => void,
  setError: (e: Error) => void,
): Cancellable {
  const { method, headers, serializer, deserializer } = { ...defaults, ...params };
  const srlReq = serializer(rq);

  let getUrl = url;
  if (method === 'get' && srlReq) {
    getUrl = `${url}?${srlReq}`;
  }

  const controller = new AbortController();
  const fetchPromise = fetch(method === 'get' ? getUrl : url, {
    ...defaults,
    method,
    headers,
    body: method === 'post' ? srlReq : undefined,
    signal: controller.signal,
  });

  setPending(true);
  fetchPromise
    .then(deserializer)
    .then(setValue)
    .catch(setError)
    .finally(() => {
      setPending(false);
    });

  return () => {
    controller.abort();
  };
}

export type FetchDataBoxProps<RQ, V> = DataBoxProps<RQ, V, HttpRequestParams<RQ, V>>;

export function createFetchDataBox<RQ, V>(
  url: string,
  params: HttpRequestParams<RQ, V>,
): [
  DataBoxHook<RQ, V, HttpRequestParams<RQ, V>>,
  DataBoxComponent<RQ, V, HttpRequestParams<RQ, V>>,
] {
  return createDataBox<RQ, V, HttpRequestParams<RQ, V>>(url, params, fetchRequest);
}
