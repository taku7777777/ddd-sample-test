const db: any = {};

/**
 * Queueに積まれるタスクの型
 */
export type DataType = {
  id: string;
  queueId: string;
  triedCount: number;
  status: 'registered' | 'succeeded' | 'failed';
};

/**
 * Queueに積まれるタスクのEntityクラス
 */
export class QueueTaskEntity {
  private data: DataType;

  /** インスタンスの作成 */
  constructor(data: DataType) {
    this.data = data;
  }

  public get = () => this.data;
  public set = (data: DataType) => {
    this.data = data;
  };
}

/**
 * Task登録のUsecase (before)
 */
export const registerUsecase = async () => {
  const batch = db.batch();

  const data: DataType = {
    id: 'id',
    queueId: 'queueId',
    triedCount: 0,
    status: 'registered',
  };

  batch.set(db.collection('tasks').doc(data.id), data);

  await batch.commit();
};


/**
 * Task登録のUsecase (after)
 */
export const registerUsecase = async () => {
  const batch = db.batch();

  const entity = new QueueTaskEntity({
    id: 'id',
    queueId: 'queueId',
    triedCount: 0,
    status: 'registered',
  });

  batch.set(
    db.collection('tasks').doc(entity.get().id),
    entity.get()
  );

  await batch.commit();
};
