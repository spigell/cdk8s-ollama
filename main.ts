import { Construct } from 'constructs';
import { Size, App, Chart, ChartProps } from 'cdk8s';
import * as kplus from 'cdk8s-plus-29';
import { JsonPatch, ApiObject } from 'cdk8s';
import { Protocol } from 'cdk8s-plus-29';

const name = 'ollama'
const port = 11343

export class Ollama extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {
    namespace: name,
    labels: {
      'managed-by': id
    },
    disableResourceNameHashes: true,
  }) {
    super(scope, id, props);

    new kplus.Namespace(this, id, {metadata: {name: props.namespace || name}})

    const claim = new kplus.PersistentVolumeClaim(this, 'Claim', {
      metadata: {
      },
      storage: Size.gibibytes(50),
      accessModes: [
        kplus.PersistentVolumeAccessMode.READ_WRITE_ONCE_POD
      ],
      storageClassName: 'local-path'
  });

    const deploy = new kplus.Deployment(this, 'deploy', {
      strategy: kplus.DeploymentStrategy.recreate(),
      replicas: 1, // Set the number of Pods running at any time
  })

  const container = deploy.addContainer(
    {
      ports: [
      {
        name: 'http',
        protocol: Protocol.TCP,
        number: port,
        hostPort: 30702
      }
        ],
      image: "ollama/ollama",
      resources: {
        cpu: {
          limit: kplus.Cpu.units(1)
        }
      },
      securityContext: {ensureNonRoot: false},
      envVariables: {
        OLLAMA_HOST: kplus.EnvValue.fromValue(`0.0.0.0:${port}`),
      }
    }
  )

  container.mount('/root/.ollama', kplus.Volume.fromPersistentVolumeClaim(this, "models", claim));
  container.mount('/tmp', kplus.Volume.fromEmptyDir(this, "tmp", "tmp"))

  // After defining the deployment and its containers
  const apiObject = ApiObject.of(deploy);
  apiObject.addJsonPatch(JsonPatch.add('/spec/template/spec/runtimeClassName', 'nvidia'));

  deploy.exposeViaService({
    name: id,
    serviceType: kplus.ServiceType.NODE_PORT
  })
}}

const app = new App();
new Ollama(app, 'cdk8s-ollama');
app.synth();
