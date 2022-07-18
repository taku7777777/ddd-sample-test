// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import {FirestoreRef} from '@bitkey-service/v2_core-store/lib/firestore/firestoreRef';

const logger: any = {};
const Firestore: any = {};
const QueueCollectionPath: any = {};
const Param1CollectionPath: any = {};
const Param2CollectionPath: any = {};
const Param3CollectionPath: any = {};
const QueueProgressTaskCollectionPath: any = {};
const QueueTaskStatusCollectionPath: any = {};
const QueueTasksCollectionPath: any = {};
const QueueFailedTasksCollectionPath: any = {};
const DeviceCollectionPath: any = {};
const QueueTaskService: any = {};
const deliveryTaskExecutor: any = {};
const FirestoreBatch: any = {};
const DeviceService: any = {};
const reCheck: any = {};
const executor: any = {};
const resultChecker: any = {};

type QueueTaskType = any;

/**
 * Queueに新たなTaskが登録されたり、実行中のTaskが完了した際に実行される処理。
 * 次に実行すべきTaskをの特定や、実施すべきTaskの実行を行う
 */
export const FirestoreQueueTrigger = async (arg: {queueId: string; taskId: string}) => {
  logger.info('starting FirestoreQueueTrigger...');

  const id: string = arg.queueId; // QueueのドキュメントId
  const progressingTaskId = arg.taskId; // 実行中のTaskのId

  const queueTaskService = QueueTaskService.init();
  if (!progressingTaskId) {
    // 処理中のTaskがない場合には次のTaskを探して更新する
    return queueTaskService.setCurrentTask({
      queueId: id,
    });
  }

  const currentTask = await Firestore.get(FirestoreRef.doc(QueueProgressTaskCollectionPath(), progressingTaskId));
  if (!currentTask) {
    // 処理中のTaskがない場合には次のTaskを探して更新する
    return queueTaskService.setCurrentTask({
      queueId: id,
    });
  }

  // Task実行する前にチェックをする
  await queueTaskService.validate({currentTask});

  try {
    // taskの種別に応じて処理を実施
    switch (currentTask.type) {
      case 'delivery':
        if (!currentTask.deliveryTargetId) {
          // 処理対象が見つからない場合には除外する
          return queueTaskService.removeStackTasks({
            currentTaskId: currentTask.id,
          });
        }

        await deliveryTaskExecutor.handle({
          queueId: id,
          param1: currentTask.param1,
          param2: currentTask.param2,
          param3: currentTask.param3,
        });
        break;
      case 'other task type':
        // 割愛 ...
        break;
      default: {
        throw new Error(`not-implemented`);
      }
    }
  } catch (e) {
    await QueueTaskService.init().updateProgressTaskBatchFailed({
      type: currentTask.type,
      currentTaskId: currentTask.id,
      failedReason: e.stack,
      errorCode: e.code,
    });
  }
};

/**
 * Queueに積まれたTaskの実行の制御を行うクラス
 * 次のTaskの特定や、validation処理をもつ
 */
export class QueueTaskServiceImpl {
  public setCurrentTask = async (param: {queueId: string}) => {
    const {queueId} = param;
    const currentTask = await this.getCurrentTask(queueId);

    if (currentTask) {
      logger.log('task is progress yet.', {currentTaskId: currentTask.id});
      return;
    }

    const nextTask = await this.getNextTask(queueId);
    if (!nextTask) {
      logger.warn('task is not found');
      throw new Error('task-is-not-found');
    }

    const batch = new FirestoreBatch();
    await batch
      .add(FirestoreRef.doc(QueueTaskStatusCollectionPath(), queueId), {
        progressingTaskId: nextTask.id,
      })
      .add(FirestoreRef.doc(QueueProgressTaskCollectionPath(), nextTask.id), {
        ...nextTask,
        startAt: new Date(),
        retryCount: nextTask.retryCount,
      });

    if (nextTask) {
      batch.delete(FirestoreRef.doc(QueueTasksCollectionPath(), nextTask.id), {
        ...nextTask,
        deliveryTargetType: 'nfc',
      });
    }
    await batch.commit();
  };

  public validate = async (task: QueueTaskType) => {
    if (!task) {
      throw new Error('task-is-not-found');
    }

    if (task.forceSkipped) {
      // 強制スキップする場合には、除外する
      await this.removeStackTasks({taskId: task.id});
    }

    // 10回以上処理が失敗している場合はタスクを処理する
    // 実行タイプによって処理をわける
    if (task.retryCount >= 10) {
      switch (task.type) {
        case 'delivery':
          await this.taskTurnLater({
            queueId: task.queueId,
            taskId: task.id,
          });
          break;
        default:
          await this.removeStackTasks({taskId: task.id});
          break;
      }
    }

    // 3回以上retryしてる時はなんかおかしいので、Deviceの再起動をする
    if (task.deviceId && task.retryCount === 3) {
      const device = await Firestore.get(FirestoreRef.doc(DeviceCollectionPath(), task.deviceId));
      if (device) {
        await DeviceService.reboot({deviceId: device.id});
      }
    }
  };

  /**
   * nfcカードが既に削除されているのに再配信しようとしている場合など、
   * どうしようもない時にtasksから除外するロジックです。
   * @param progressId
   * @param organizationId
   * @param logger
   */
  public removeStackTasks = async (param: {taskId: string}) => {
    const {taskId} = param;
    const {0: task, 1: currentTask, 2: failed} = await Promise.all([
      Firestore.get(FirestoreRef.doc(QueueTasksCollectionPath(), taskId)),
      Firestore.get(FirestoreRef.doc(QueueProgressTaskCollectionPath(), taskId)),
      Firestore.get(FirestoreRef.doc(QueueFailedTasksCollectionPath(), taskId)),
    ]);

    if (!task && !currentTask && !failed) {
      logger.warn('task is not found', taskId);
      return;
    }

    const batch = new FirestoreBatch();
    if (currentTask) {
      batch
        .delete(FirestoreRef.doc(QueueProgressTaskCollectionPath(), taskId), currentTask)
        .add(FirestoreRef.doc(QueueTaskStatusCollectionPath(), currentTask.deviceId), {
          progressId: '',
        });
    }
    if (task) {
      batch.moveDelete(FirestoreRef.doc(QueueTaskStatusCollectionPath(), task.id), task);
    }

    await batch.commit();
  };

  private getCurrentTask = async (...param: any[]): Promise<any> => {
    console.log(param);
  };
  private getNextTask = async (...param: any[]): Promise<any> => {
    console.log(param);
  };
  private taskTurnLater = async (...param: any[]): Promise<any> => {
    console.log(param);
  };
}

export class DeviceServiceImpl {
  public static async delivery(param: {queueId: string; param1: string; param2: string; param3: string}) {
    const {queueId, param1, param2, param3} = param;
    const {0: queue, 1: value1, 2: value2, 3: value3} = await Promise.all([
      Firestore.get(FirestoreRef.doc(QueueCollectionPath(), queueId)),
      Firestore.get(FirestoreRef.doc(Param1CollectionPath(), param1)),
      Firestore.get(FirestoreRef.doc(Param2CollectionPath(), param2)),
      Firestore.get(FirestoreRef.doc(Param3CollectionPath(), param3)),
    ]);

    if (!queue || !value1 || !value2 || !value3) {
      return QueueTaskService.removeStackTasks({taskId: queue.progressingTaskId});
    }

    await DeviceServiceImpl.deliveryProcess({
      param1: value2.value1,
      param2: value2.value2,
      param3: value1.value3,
    });
  }

  private static deliveryProcess = async (param: {param1: string; param2: string; param3: string}) => {
    const {param1, param2, param3} = param;

    if (!param1 && !param3) {
      return QueueTaskService.removeStackTasks({taskId: param2});
    }

    const result = await executor({param1, param3}).catch(async error => {
      await QueueTaskService.updateProgressTaskBatchFailed({taskId: param2});
      throw error;
    });

    if (!resultChecker(result)) {
      await QueueTaskService.updateProgressTaskBatchFailed({taskId: param2});
      throw new Error('failed');
    }

    // 配信はできたけどチェックでtimeoutになって失敗、とかは防ぎたいので3回はretryしておく
    await reCheck({
      func: executor,
      retryLimit: 3,
    }).catch(async (e: Error) => {
      await QueueTaskService.updateProgressTaskBatchFailed({taskId: param2});
      throw e;
    });

    if (!result.success) {
      await QueueTaskService.removeStackTasks({taskId: param2});
    } else {
      await QueueTaskService.updateProgressTaskBatchFailed({taskId: param2});
    }
  };
}






