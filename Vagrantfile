VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.network :forwarded_port, host: 8081, guest: 80
  config.vm.network :private_network, type: :dhcp

  config.vm.provision :shell, path: "bootstrap.sh"
  config.vm.provision :shell, inline: "service nginx start", run: :always

  config.nfs.map_uid = 0
  config.nfs.map_gid = 0

  config.vm.synced_folder ".", "/vagrant", type: :nfs,
      mount_options: ['actimeo=2', 'noatime'],
      exports_options: ['rw', 'sync', 'nohide']

  config.vm.provider "virtualbox" do |v|
    v.memory = 2048
    v.cpus = 4
  end
end
