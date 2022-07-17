export type PeopleNameValueType = {
  name?: string;
  familyName?: string;
  firstName?: string;
};

export class PeopleNameValueObject {
  private value: PeopleNameValueType;
  constructor(value: PeopleNameValueType) {
    if (!value.name && (!value.familyName || !value.firstName)) {
      throw new Error('some-property-empty');
    }

    if (Object.values(value).some(value => value.length > 100)) {
      throw new Error('property-must-under-100-characters');
    }

    this.value = value;
  }

  public getName = () => this.value.name ?? `${this.value.familyName} ${this.value.firstName}`;
}
