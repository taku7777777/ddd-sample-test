const idGen: any = {};
const db: any = {};
type Batch = any;

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

  public get = () => this.data;
}

/** Controller */
export const controller = async (queueId: string) => {
  const batch = db.batch();

  // repositoryとしてFirestoreを指定して処理実行
  await new RegisterTaskUsecase(
    new QueueTaskRepositoryFirestore(batch)
  ).handle(queueId);

  // 一括更新処理はUsecaseとは別で管理できるように
  await batch.commit();
};

/** QueueTaskを登録するためのUsecaseの処理 */
export class RegisterTaskUsecase {
  private taskRepository: QueueTaskRepository;
  constructor(taskRepository: QueueTaskRepository) {
    this.taskRepository = taskRepository;
  }

  public handle = async (queueId: string) => {
    const taskEntity = new QueueTaskEntity({
      queueId,
    });
    await this.taskRepository.save(taskEntity);
  };
}

export const registerUsecase = async () => {
  const batch = db.batch();

  const entity = new QueueTaskEntity({
    queueId: 'queueId',
  });

  // modelを用いた永続化
  await new QueueTaskRepositoryFirestore(batch).save(
    entity
  );

  await batch.commit();
};

export type QueueTaskRepository = {
  save: (task: QueueTaskEntity) => Promise<void>;
};

/**
 * QueueTaskのRepositoryクラス
 */
export class QueueTaskRepositoryFirestore {
  private batch: Batch;
  constructor(batch: Batch) {
    this.batch = batch;
  }

  public save = async (task: QueueTaskEntity) => {
    this.batch.set(
      db.collection('tasks').doc(task.get().id),
      task.get()
    );
  };
}
