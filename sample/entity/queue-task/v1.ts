const idGen: any = {};

/**
 * Queueに積まれるタスクの型
 */
export type DataType = {
  id: string; // dataのId
  queueId: string; // Queueを特定するためのId
  triedCount: number; // 試行回数
  status:
    | 'queued' // Queueに投入された直後
    | 'requeued' // 再度Queueに投入された直後
    | 'succeeded' // Taskが成功
    | 'failed'; // Taskが失敗してリトライもしない
};

export class QueueTaskEntity {
  private data: DataType;

  /** インスタンスの作成 */
  constructor(param: {queueId: string}) {
    this.data = {
      ...param,
      id: idGen(), // IDの採番
      triedCount: 0, // 試行回数は0で初期化
      status: 'queued', // Queue投入直後のステータスで初期化
    };
  }

  /** 失敗した際の処理 */
  public onFail = () => {
    // 試行回数をインクリメント
    this.data.triedCount = this.data.triedCount + 1;

    if (this.data.triedCount >= 10) {
      // 10回以上実施しても成功しない場合には失敗扱いでリトライしない
      this.data.status = 'failed';
    } else {
      // 10回未満の場合にはリトライ対象とする
      this.data.status = 'requeued';
    }
  };
}
