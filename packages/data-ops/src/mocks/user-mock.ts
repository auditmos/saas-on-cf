import type {
  User,
  UserCreateInput,
  UserUpdateInput,
  PaginationQuery,
  UserListResponseData
} from '../zod-schema/user';

class MockUserStore {
  private users: User[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com' },
    { id: '4', name: 'Diana', email: 'diana@example.com' },
    { id: '5', name: 'Eve', email: 'eve@example.com' },
    { id: '6', name: 'Frank', email: 'frank@example.com' },
    { id: '7', name: 'Grace', email: 'grace@example.com' },
    { id: '8', name: 'Henry', email: 'henry@example.com' },
    { id: '9', name: 'Ivy', email: 'ivy@example.com' },
    { id: '10', name: 'Jack', email: 'jack@example.com' },
    { id: '11', name: 'Kate', email: 'kate@example.com' },
    { id: '12', name: 'Leo', email: 'leo@example.com' },
    { id: '13', name: 'Mia', email: 'mia@example.com' },
    { id: '14', name: 'Noah', email: 'noah@example.com' },
    { id: '15', name: 'Olivia', email: 'olivia@example.com' },
    { id: '16', name: 'Paul', email: 'paul@example.com' },
    { id: '17', name: 'Quinn', email: 'quinn@example.com' },
    { id: '18', name: 'Ryan', email: 'ryan@example.com' },
    { id: '19', name: 'Sara', email: 'sara@example.com' },
    { id: '20', name: 'Tom', email: 'tom@example.com' }
  ];
  private nextId = 21;

  getPaginated({ limit, offset }: PaginationQuery): UserListResponseData {
    const total = this.users.length;
    const data = this.users.slice(offset, offset + limit);
    return {
      data,
      pagination: { total, limit, offset, hasMore: offset + limit < total }
    };
  }

  findById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  findByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }

  create(data: UserCreateInput): User {
    const user: User = { id: String(this.nextId++), ...data };
    this.users.push(user);
    return user;
  }

  update(id: string, data: UserUpdateInput): User {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User not found');
    }
    const existing = this.users[index];
    if (!existing) {
      throw new Error('User not found');
    }
    const updated: User = {
      id: existing.id,
      name: data.name ?? existing.name,
      email: data.email ?? existing.email
    };
    this.users[index] = updated;
    return updated;
  }

  delete(id: string): void {
    this.users = this.users.filter(u => u.id !== id);
  }
}

export const mockUsers = new MockUserStore();
