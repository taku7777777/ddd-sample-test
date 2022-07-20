// sampleUsecaseDependency.ts (dependencyのみ切り出したもの)
export type SampleDependencyType = {
  userQuery: IUserQuery; // IF定義
};
export const getDefaultDependency = (): SampleDependencyType => ({
  userQuery: userQueryImpl, // 実態の処理
});

// sampleUsecase.ts (usecaseの処理)
export class SampleUsecase {
  private dependency: SampleDependencyType;
  constructor(dependency?: SampleDependencyType) {
    this.dependency = dependency ?? getDefaultDependency();
  }
  public handle = async (userId: string) => {
    const user = await this.dependency.userQuery(userId);
    return user;
  };
}

// controller.ts (実際に動作させる処理)
export const sampleController = async () => {
  await new SampleUsecase().handle('userId');
};

// sampleUsecase.test.ts (テストでmockを利用したいときとか)
test('sample usecase', async () => {
  const userQueryMock = jest.mock; // mock処理
  new SampleUsecase({userQuery: userQueryMock}).handle('userId');
});
