type ServiceName = string;

class ServiceLocator {
    private readonly services = new Map<ServiceName, unknown>();

    registerService<T>(name: ServiceName, service: T): void {
        if (this.services.has(name)) {
            throw new Error(`Service '${name}' is already registered.`);
        }
        this.services.set(name, service);
    }

    getService<T>(name: ServiceName): T | undefined {
        return this.services.get(name) as T | undefined;
    }

    hasService(name: ServiceName): boolean {
        return this.services.has(name);
    }
}

export const serviceLocator = new ServiceLocator();
